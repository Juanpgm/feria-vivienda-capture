import { beforeEach, describe, expect, it, vi } from "vitest";

const setCustomUserClaims = vi.fn();
const revokeRefreshTokens = vi.fn();
vi.mock("@/shared/firebase/admin", () => ({ adminAuth: () => ({ setCustomUserClaims, revokeRefreshTokens }) }));
const requireSesion = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/modules/auth/server/sesion", async (orig) => ({ ...(await orig<object>()), requireSesion: (r: string) => requireSesion(r) }));
const repo = vi.hoisted(() => ({
  obtenerUsuario: vi.fn(),
  actualizarPerfil: vi.fn(),
  crearSolicitudRol: vi.fn(),
  obtenerSolicitud: vi.fn(),
  resolverSolicitud: vi.fn(),
  cambiarRol: vi.fn(),
}));
vi.mock("@/modules/auth/server/usuarios.repo", () => repo);

import { POST as datos } from "./datos/route";
import { POST as solicitar } from "./solicitud-rol/route";
import { POST as resolver } from "../usuarios/solicitudes/[uid]/route";

const req = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });
const actor = (rol: string, uid = "yo") => requireSesion.mockResolvedValue({ uid, correo: `${uid}@cali.gov.co`, rol, aprobado: true });

describe("POST /api/cuenta/datos", () => {
  beforeEach(() => vi.clearAllMocks());
  it("updates only the caller's own profile, normalized", async () => {
    actor("usuario");
    const r = await datos(req({ nombre: "juan pérez", celular: "3001234567", cedula: "1.144.555", cargo: "", uid: "otro" }));
    expect(r.status).toBe(200);
    expect(repo.actualizarPerfil).toHaveBeenCalledWith("yo", { nombre: "Juan Pérez", celular: "+573001234567", cedula: "1144555", cargo: null });
  });
  it("422 on invalid data", async () => {
    actor("usuario");
    expect((await datos(req({ nombre: "" }))).status).toBe(422);
    expect(repo.actualizarPerfil).not.toHaveBeenCalled();
  });
});

describe("POST /api/cuenta/solicitud-rol", () => {
  beforeEach(() => vi.clearAllMocks());
  it("records a pending request for a higher role", async () => {
    actor("usuario");
    repo.obtenerUsuario.mockResolvedValue({ nombre: "Yo", correo: "yo@cali.gov.co", rol: "usuario" });
    repo.crearSolicitudRol.mockResolvedValue("creada");
    expect((await solicitar(req({ rol: "inspector", motivo: "Visitas técnicas" }))).status).toBe(200);
    expect(repo.crearSolicitudRol).toHaveBeenCalledWith(
      "yo",
      expect.objectContaining({ rol_actual: "usuario", rol_solicitado: "inspector", motivo: "Visitas técnicas" }),
    );
  });
  it("rejects same or lower roles and duplicate pending requests", async () => {
    actor("inspector");
    repo.obtenerUsuario.mockResolvedValue({ nombre: "Yo", correo: "c", rol: "inspector" });
    expect((await solicitar(req({ rol: "inspector", motivo: "Necesito el rol" }))).status).toBe(422);
    expect((await solicitar(req({ rol: "usuario", motivo: "Necesito el rol" }))).status).toBe(422);
    repo.crearSolicitudRol.mockResolvedValue("ya_pendiente");
    expect((await solicitar(req({ rol: "admin", motivo: "Necesito el rol" }))).status).toBe(409);
  });
});

describe("POST /api/usuarios/solicitudes/[uid]", () => {
  const llamar = (uid: string, body: unknown) => resolver(req(body), { params: Promise.resolve({ uid }) });
  beforeEach(() => {
    vi.clearAllMocks();
    repo.obtenerSolicitud.mockResolvedValue({ estado: "pendiente", rol_actual: "usuario", rol_solicitado: "inspector" });
    repo.obtenerUsuario.mockResolvedValue({ rol: "usuario", esta_aprobado: true });
  });
  it("admin approves usuario -> inspector: role changed, session revoked, request closed", async () => {
    actor("admin", "adm");
    expect((await llamar("u1", { aprobar: true })).status).toBe(200);
    expect(setCustomUserClaims).toHaveBeenCalledWith("u1", { rol: "inspector", aprobado: true });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("u1");
    expect(repo.cambiarRol).toHaveBeenCalledWith("u1", "inspector", "adm");
    expect(repo.resolverSolicitud).toHaveBeenCalledWith("u1", "aprobada", "adm", null);
  });
  it("admin cannot grant admin; superadmin can; rejecting changes no role", async () => {
    repo.obtenerSolicitud.mockResolvedValue({ estado: "pendiente", rol_actual: "usuario", rol_solicitado: "admin" });
    actor("admin", "adm");
    expect((await llamar("u1", { aprobar: true })).status).toBe(403);
    expect((await llamar("u1", { aprobar: false, motivo: "No corresponde" })).status).toBe(403);
    actor("superadmin", "sup");
    expect((await llamar("u1", { aprobar: false, motivo: "No corresponde" })).status).toBe(200);
    expect(repo.resolverSolicitud).toHaveBeenCalledWith("u1", "rechazada", "sup", "No corresponde");
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });
  it("404 without a pending request; nobody resolves their own", async () => {
    actor("superadmin", "sup");
    repo.obtenerSolicitud.mockResolvedValue(null);
    expect((await llamar("u1", { aprobar: true })).status).toBe(404);
    repo.obtenerSolicitud.mockResolvedValue({ estado: "pendiente", rol_actual: "admin", rol_solicitado: "superadmin" });
    repo.obtenerUsuario.mockResolvedValue({ rol: "admin", esta_aprobado: true });
    expect((await llamar("sup", { aprobar: true })).status).toBe(403);
  });
  it("a retry after the role was applied but the request not closed just closes it", async () => {
    actor("superadmin", "sup");
    repo.obtenerUsuario.mockResolvedValue({ rol: "inspector", esta_aprobado: true });
    expect((await llamar("u1", { aprobar: true })).status).toBe(200);
    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(repo.resolverSolicitud).toHaveBeenCalledWith("u1", "aprobada", "sup", null);
  });

  it("a stale request (role changed meanwhile) is refused", async () => {
    repo.obtenerSolicitud.mockResolvedValue({ estado: "pendiente", rol_actual: "usuario", rol_solicitado: "admin" });
    actor("superadmin", "sup");
    repo.obtenerUsuario.mockResolvedValue({ rol: "inspector", esta_aprobado: true });
    expect((await llamar("u1", { aprobar: true })).status).toBe(409);
  });
});
