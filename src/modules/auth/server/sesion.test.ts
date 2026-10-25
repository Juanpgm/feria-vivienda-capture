import { beforeEach, describe, expect, it, vi } from "vitest";

const verifySessionCookie = vi.fn();
vi.mock("@/shared/firebase/admin", () => ({ adminAuth: () => ({ verifySessionCookie }) }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { correoEnDominio, puedeGestionar, rechazoPorProveedor } from "../domain/roles";
import { SesionError, verificarSesion } from "./sesion";

const claims = (rol: unknown, aprobado: unknown = true, email = "a@cali.gov.co", provider = "google.com") => ({
  uid: "u1",
  email,
  rol,
  aprobado,
  firebase: { sign_in_provider: provider },
});

async function status(p: Promise<unknown>) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  return e instanceof SesionError ? e.status : null;
}

describe("verificarSesion (role gate)", () => {
  beforeEach(() => {
    verifySessionCookie.mockReset(); // braces: a returned function would run as teardown
  });

  it("401 without cookie or when verification fails", async () => {
    expect(await status(verificarSesion(undefined, "usuario"))).toBe(401);
    verifySessionCookie.mockImplementation(() => {
      throw new Error("revoked");
    });
    expect(await status(verificarSesion("c", "usuario"))).toBe(401);
  });

  it("403 when not approved or role claim is missing/invalid", async () => {
    verifySessionCookie.mockResolvedValue(claims("usuario", false));
    expect(await status(verificarSesion("c", "usuario"))).toBe(403);
    verifySessionCookie.mockResolvedValue(claims("root"));
    expect(await status(verificarSesion("c", "usuario"))).toBe(403);
  });

  it("enforces usuario < admin < superadmin", async () => {
    verifySessionCookie.mockResolvedValue(claims("admin"));
    expect((await verificarSesion("c", "usuario")).rol).toBe("admin");
    expect((await verificarSesion("c", "admin")).uid).toBe("u1");
    expect(await status(verificarSesion("c", "superadmin"))).toBe(403);
  });
});

describe("pending sessions (read-only opt-in)", () => {
  beforeEach(() => {
    verifySessionCookie.mockReset();
  });

  it("strict by default: unapproved Google+cali is rejected on data-entry routes", async () => {
    verifySessionCookie.mockResolvedValue(claims(undefined, undefined));
    expect(await status(verificarSesion("c", "usuario"))).toBe(403);
    expect(await status(verificarSesion("c", "usuario", { permitirPendiente: false }))).toBe(403);
  });

  it("permitirPendiente admits unapproved Google+cali as a non-approved usuario", async () => {
    verifySessionCookie.mockResolvedValue(claims(undefined, undefined));
    expect(await verificarSesion("c", "usuario", { permitirPendiente: true })).toMatchObject({
      rol: "usuario",
      aprobado: false,
    });
    expect(await status(verificarSesion("c", "admin", { permitirPendiente: true }))).toBe(403);
  });

  it("permitirPendiente never admits password or out-of-domain sessions", async () => {
    verifySessionCookie.mockResolvedValue(claims(undefined, undefined, "a@cali.gov.co", "password"));
    expect(await status(verificarSesion("c", "usuario", { permitirPendiente: true }))).toBe(403);
    verifySessionCookie.mockResolvedValue(claims(undefined, undefined, "a@gmail.com"));
    expect(await status(verificarSesion("c", "usuario", { permitirPendiente: true }))).toBe(403);
  });
});

describe("rechazoPorProveedor (provider-based admission)", () => {
  it("google.com requires the domain and a verified email", () => {
    expect(rechazoPorProveedor("google.com", "a@cali.gov.co", true)).toBeNull();
    expect(rechazoPorProveedor("google.com", "a@gmail.com", true)).toBe("dominio");
    expect(rechazoPorProveedor("google.com", "a@cali.gov.co", false)).toBe("no_verificado");
  });

  it("password accepts any domain; other providers are rejected", () => {
    expect(rechazoPorProveedor("password", "a@gmail.com", false)).toBeNull();
    expect(rechazoPorProveedor("password", "a@cali.gov.co", false)).toBeNull();
    expect(rechazoPorProveedor("anonymous", undefined, false)).toBe("proveedor");
    expect(rechazoPorProveedor(undefined, "a@cali.gov.co", true)).toBe("proveedor");
  });
});

describe("approval rules", () => {
  it("admin manages only usuario; superadmin manages all; usuario none", () => {
    expect(puedeGestionar("admin", "usuario")).toBe(true);
    expect(puedeGestionar("admin", "admin")).toBe(false);
    expect(puedeGestionar("admin", "superadmin")).toBe(false);
    expect(puedeGestionar("superadmin", "admin")).toBe(true);
    expect(puedeGestionar("usuario", "usuario")).toBe(false);
  });

  it("domain check is exact on the suffix", () => {
    expect(correoEnDominio("Ana@Cali.gov.co")).toBe(true);
    expect(correoEnDominio("ana@gmail.com")).toBe(false);
    expect(correoEnDominio("ana@cali.gov.co.evil.com")).toBe(false);
    expect(correoEnDominio("ana@evilcali.gov.co")).toBe(false);
    expect(correoEnDominio(undefined)).toBe(false);
  });
});
