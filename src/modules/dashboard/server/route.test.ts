import { beforeEach, describe, expect, it, vi } from "vitest";

// Real role gate (verificarSesion) over a mocked Admin Auth and a mocked repo: no Firestore involved.
const verifySessionCookie = vi.fn();
vi.mock("@/shared/firebase/admin", () => ({ adminAuth: () => ({ verifySessionCookie }) }));
const cookie = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
const obtenerDashboard = vi.fn();
vi.mock("@/modules/dashboard/server/dashboard.repo", () => ({ obtenerDashboard: (...a: unknown[]) => obtenerDashboard(...a) }));

import { GET } from "@/app/api/dashboard/route";

const claims = (rol: string, aprobado: boolean, provider = "google.com", email = "a@cali.gov.co") => ({
  uid: "u1",
  email,
  rol,
  aprobado,
  firebase: { sign_in_provider: provider },
});
const llamar = (qs = "") => GET(new Request(`http://x/api/dashboard${qs}`));

describe("GET /api/dashboard (role gate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookie.mockReturnValue({ value: "c" });
    obtenerDashboard.mockResolvedValue({ alcance: "x" });
  });

  it("401 without cookie, nothing read", async () => {
    cookie.mockReturnValue(undefined);
    expect((await llamar()).status).toBe(401);
    expect(obtenerDashboard).not.toHaveBeenCalled();
  });

  it("401 when the cookie does not verify", async () => {
    verifySessionCookie.mockRejectedValue(new Error("revoked"));
    expect((await llamar()).status).toBe(401);
  });

  it.each([
    ["superadmin", "completo"],
    ["admin", "completo"],
    ["usuario", "usuario"],
  ])("approved %s gets scope %s", async (rol, alcance) => {
    verifySessionCookie.mockResolvedValue(claims(rol, true, "password", "x@gmail.com"));
    const res = await llamar("?desde=2026-03-01&funcionario=u2");
    expect(res.status).toBe(200);
    expect(obtenerDashboard.mock.calls[0][0]).toMatchObject({ alcance, uid: "u1", filtros: { desde: "2026-03-01", funcionario: "u2" } });
  });

  it("unapproved institutional Google session: read-only scope", async () => {
    verifySessionCookie.mockResolvedValue(claims("usuario", false));
    expect((await llamar()).status).toBe(200);
    expect(obtenerDashboard.mock.calls[0][0]).toMatchObject({ alcance: "lectura" });
  });

  it("unapproved password account or non-institutional Google: 403", async () => {
    verifySessionCookie.mockResolvedValue(claims("usuario", false, "password"));
    expect((await llamar()).status).toBe(403);
    verifySessionCookie.mockResolvedValue(claims("usuario", false, "google.com", "a@gmail.com"));
    expect((await llamar()).status).toBe(403);
    expect(obtenerDashboard).not.toHaveBeenCalled();
  });

  it("422 on invalid filters", async () => {
    verifySessionCookie.mockResolvedValue(claims("admin", true));
    const res = await llamar("?desde=2026-02-30");
    expect(res.status).toBe(422);
    expect(obtenerDashboard).not.toHaveBeenCalled();
  });
});
