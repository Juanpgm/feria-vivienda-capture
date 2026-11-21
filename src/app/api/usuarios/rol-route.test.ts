import { beforeEach, describe, expect, it, vi } from "vitest";

const setCustomUserClaims = vi.fn();
const revokeRefreshTokens = vi.fn();
vi.mock("@/shared/firebase/admin", () => ({ adminAuth: () => ({ setCustomUserClaims, revokeRefreshTokens }) }));
const requireSesion = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/modules/auth/server/sesion", async (orig) => ({
  ...(await orig<object>()),
  requireSesion: (r: string) => requireSesion(r),
}));
const obtenerUsuario = vi.fn();
const cambiarRol = vi.fn();
vi.mock("@/modules/auth/server/usuarios.repo", () => ({
  obtenerUsuario: (u: string) => obtenerUsuario(u),
  cambiarRol: (...a: unknown[]) => cambiarRol(...a),
}));

import { SesionError } from "@/modules/auth/server/sesion";
import { POST } from "./[uid]/rol/route";

const llamar = (uid: string, body: unknown) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ uid }) });
const actor = (rol: string, uid = "act") =>
  requireSesion.mockResolvedValue({ uid, correo: `${uid}@cali.gov.co`, rol, aprobado: true });
const objetivo = (rol: string, esta_aprobado = true) => obtenerUsuario.mockResolvedValue({ rol, esta_aprobado });

describe("POST /api/usuarios/[uid]/rol", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin turns a usuario into inspector: doc, claims and revoked session", async () => {
    actor("admin");
    objetivo("usuario");
    const res = await llamar("u1", { rol: "inspector" });
    expect(res.status).toBe(200);
    expect(cambiarRol).toHaveBeenCalledWith("u1", "inspector", "act");
    expect(setCustomUserClaims).toHaveBeenCalledWith("u1", { rol: "inspector", aprobado: true });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("u1");
  });

  it("admin cannot grant admin nor touch an admin; superadmin can", async () => {
    actor("admin");
    objetivo("inspector");
    expect((await llamar("u1", { rol: "admin" })).status).toBe(403);
    objetivo("admin");
    expect((await llamar("u1", { rol: "usuario" })).status).toBe(403);
    expect(cambiarRol).not.toHaveBeenCalled();
    actor("superadmin");
    objetivo("admin");
    expect((await llamar("u1", { rol: "superadmin" })).status).toBe(200);
  });

  it("nobody changes their own role", async () => {
    actor("superadmin", "yo");
    objetivo("superadmin");
    expect((await llamar("yo", { rol: "usuario" })).status).toBe(403);
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("same role is a no-op that keeps the session", async () => {
    actor("admin");
    objetivo("inspector");
    expect((await llamar("u1", { rol: "inspector" })).status).toBe(200);
    expect(cambiarRol).not.toHaveBeenCalled();
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("404 unknown, 409 pending (use approve), 422 invalid role, gate for non-admins", async () => {
    actor("superadmin");
    obtenerUsuario.mockResolvedValue(null);
    expect((await llamar("u1", { rol: "inspector" })).status).toBe(404);
    objetivo("usuario", false);
    expect((await llamar("u1", { rol: "inspector" })).status).toBe(409);
    expect((await llamar("u1", { rol: "rey" })).status).toBe(422);
    requireSesion.mockRejectedValue(new SesionError(403, "No tiene permisos"));
    expect((await llamar("u1", { rol: "inspector" })).status).toBe(403);
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });
});
