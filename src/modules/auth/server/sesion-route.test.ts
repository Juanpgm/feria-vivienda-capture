import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
const deleteUser = vi.fn();
const createSessionCookie = vi.fn();
const setCustomUserClaims = vi.fn();
vi.mock("@/shared/firebase/admin", () => ({
  adminAuth: () => ({ verifyIdToken, deleteUser, createSessionCookie, setCustomUserClaims }),
}));
const obtenerUsuario = vi.fn();
const crearUsuario = vi.fn();
vi.mock("./usuarios.repo", () => ({
  obtenerUsuario: (u: string) => obtenerUsuario(u),
  crearUsuario: (...a: unknown[]) => crearUsuario(...a),
}));

import { POST } from "@/app/api/auth/sesion/route";

const llamar = () =>
  POST(new Request("http://x/api/auth/sesion", { method: "POST", body: JSON.stringify({ idToken: "token-largo-1234" }) }));
const token = (provider: string, email: string, extra: object = {}) => ({
  uid: "u1",
  email,
  email_verified: true,
  firebase: { sign_in_provider: provider },
  ...extra,
});
const usuario = (aprobado: boolean, estado?: string) => ({
  correo: "x",
  nombre: "x",
  rol: "usuario",
  esta_aprobado: aprobado,
  proveedor: "x",
  estado,
});

describe("POST /api/auth/sesion (provider rule + cookie)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSessionCookie.mockResolvedValue("cookie");
    deleteUser.mockResolvedValue(undefined);
  });

  it("Google outside the domain: 403, user deleted, no cookie", async () => {
    verifyIdToken.mockResolvedValue(token("google.com", "a@gmail.com"));
    const res = await llamar();
    expect(res.status).toBe(403);
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(res.cookies.get("sesion")).toBeUndefined();
  });

  it("Google inside the domain, unapproved: read-only cookie", async () => {
    verifyIdToken.mockResolvedValue(token("google.com", "a@cali.gov.co"));
    obtenerUsuario.mockResolvedValue(usuario(false));
    const res = await llamar();
    expect((await res.json()).estado).toBe("lectura");
    expect(res.cookies.get("sesion")?.value).toBe("cookie");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("password with any domain, unapproved: pending, no cookie, not deleted", async () => {
    verifyIdToken.mockResolvedValue(token("password", "a@gmail.com"));
    obtenerUsuario.mockResolvedValue(usuario(false));
    const res = await llamar();
    expect((await res.json()).estado).toBe("pendiente");
    expect(res.cookies.get("sesion")).toBeUndefined();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("approved users (any provider) get a cookie when claims match", async () => {
    obtenerUsuario.mockResolvedValue(usuario(true));
    for (const t of [token("password", "a@gmail.com", { aprobado: true, rol: "usuario" }), token("google.com", "a@cali.gov.co", { aprobado: true, rol: "usuario" })]) {
      verifyIdToken.mockResolvedValue(t);
      const res = await llamar();
      expect((await res.json()).estado).toBe("aprobado");
      expect(res.cookies.get("sesion")?.value).toBe("cookie");
    }
  });

  it("rejected users get 403 with the Spanish message and no cookie (Google cali and password)", async () => {
    obtenerUsuario.mockResolvedValue(usuario(false, "rechazado"));
    for (const t of [token("google.com", "a@cali.gov.co"), token("password", "a@gmail.com")]) {
      verifyIdToken.mockResolvedValue(t);
      const res = await llamar();
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe("Su solicitud no fue aprobada. Comuníquese con un administrador.");
      expect(res.cookies.get("sesion")).toBeUndefined();
    }
    expect(createSessionCookie).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("re-registering with a rejected account creates no new pending doc", async () => {
    verifyIdToken.mockResolvedValue(token("google.com", "a@cali.gov.co"));
    obtenerUsuario.mockResolvedValue(usuario(false, "rechazado"));
    await llamar();
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it("a rejected user who was later approved gets a normal session", async () => {
    verifyIdToken.mockResolvedValue(token("password", "a@gmail.com", { aprobado: true, rol: "usuario" }));
    obtenerUsuario.mockResolvedValue(usuario(true, "aprobado"));
    expect((await llamar()).status).toBe(200);
  });
});
