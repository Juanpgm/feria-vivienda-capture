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
const rechazarUsuario = vi.fn();
vi.mock("@/modules/auth/server/usuarios.repo", () => ({
  obtenerUsuario: (u: string) => obtenerUsuario(u),
  rechazarUsuario: (...a: unknown[]) => rechazarUsuario(...a),
}));

import { SesionError } from "@/modules/auth/server/sesion";
import { POST } from "./[uid]/rechazar/route";

const llamar = (uid: string, body: unknown = {}) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ uid }) });
const actor = (rol: string, uid = "act") =>
  requireSesion.mockResolvedValue({ uid, correo: `${uid}@cali.gov.co`, rol, aprobado: true });
const objetivo = (rol: string) => obtenerUsuario.mockResolvedValue({ rol, esta_aprobado: false });

describe("POST /api/usuarios/[uid]/rechazar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rechazarUsuario.mockResolvedValue("rechazado");
  });

  it("admin rejects a usuario: doc updated, claims cleared, tokens revoked", async () => {
    actor("admin");
    objetivo("usuario");
    const res = await llamar("u1", { motivo: " no corresponde " });
    expect(res.status).toBe(200);
    expect(rechazarUsuario).toHaveBeenCalledWith("u1", { uid: "act", correo: "act@cali.gov.co" }, "no corresponde");
    expect(setCustomUserClaims).toHaveBeenCalledWith("u1", { aprobado: false });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("u1");
  });

  it("admin cannot reject an admin or superadmin; superadmin can reject any role", async () => {
    actor("admin");
    for (const rol of ["admin", "superadmin"]) {
      objetivo(rol);
      expect((await llamar("u1")).status).toBe(403);
    }
    expect(rechazarUsuario).not.toHaveBeenCalled();
    actor("superadmin");
    for (const rol of ["usuario", "admin", "superadmin"]) {
      objetivo(rol);
      expect((await llamar("u1")).status).toBe(200);
    }
  });

  it("nobody rejects themselves, not even a superadmin", async () => {
    actor("superadmin", "yo");
    objetivo("superadmin");
    expect((await llamar("yo")).status).toBe(403);
    expect(rechazarUsuario).not.toHaveBeenCalled();
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("a plain usuario is stopped by the session gate", async () => {
    requireSesion.mockRejectedValue(new SesionError(403, "No tiene permisos"));
    expect((await llamar("u1")).status).toBe(403);
    expect(obtenerUsuario).not.toHaveBeenCalled();
  });

  it("404 for unknown users; 409 for approved ones (no claims change)", async () => {
    actor("superadmin");
    obtenerUsuario.mockResolvedValue(null);
    expect((await llamar("u1")).status).toBe(404);
    objetivo("usuario");
    rechazarUsuario.mockResolvedValue("aprobado");
    expect((await llamar("u1")).status).toBe(409);
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("motivo over 200 chars is rejected with 422", async () => {
    actor("superadmin");
    objetivo("usuario");
    expect((await llamar("u1", { motivo: "x".repeat(201) })).status).toBe(422);
    expect((await llamar("u1", { motivo: "x".repeat(200) })).status).toBe(200);
  });

  it("idempotent: repeating re-applies claims and reports ya_rechazado", async () => {
    actor("admin");
    objetivo("usuario");
    rechazarUsuario.mockResolvedValue("ya_rechazado");
    const res = await llamar("u1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ya_rechazado: true });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("u1");
  });
});
