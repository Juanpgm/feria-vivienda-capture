import { describe, expect, it } from "vitest";
import { ROLES, permisoSobreUsuario, type Rol } from "./roles";

const u = (uid: string, rol: Rol) => ({ uid, rol });

describe("permisoSobreUsuario (approve / reject matrix)", () => {
  it("admin acts only on other usuario accounts", () => {
    expect(permisoSobreUsuario(u("a", "admin"), u("x", "usuario"))).toBe("ok");
    expect(permisoSobreUsuario(u("a", "admin"), u("x", "admin"))).toBe("rol");
    expect(permisoSobreUsuario(u("a", "admin"), u("x", "superadmin"))).toBe("rol");
  });

  it("superadmin acts on every role", () => {
    for (const rol of ROLES) expect(permisoSobreUsuario(u("s", "superadmin"), u("x", rol))).toBe("ok");
  });

  it("usuario never acts", () => {
    for (const rol of ROLES) expect(permisoSobreUsuario(u("p", "usuario"), u("x", rol))).toBe("rol");
  });

  it("nobody acts on their own account, whatever the role", () => {
    for (const rol of ROLES) expect(permisoSobreUsuario(u("same", rol), u("same", rol))).toBe("propia");
  });
});
