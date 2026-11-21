import { describe, expect, it } from "vitest";
import { perfilSchema, rolesSolicitables, solicitudRolSchema } from "./perfil";

describe("perfilSchema", () => {
  it("normalizes name, mobile and ID; empty optional fields become null", () => {
    expect(perfilSchema.parse({ nombre: "  juan  pérez ", celular: "300 123 4567", cedula: "1.144.555", cargo: " Arquitecto " })).toEqual({
      nombre: "Juan Pérez",
      celular: "+573001234567",
      cedula: "1144555",
      cargo: "Arquitecto",
    });
    expect(perfilSchema.parse({ nombre: "Ana Ruiz", celular: "", cedula: "", cargo: "" })).toEqual({ nombre: "Ana Ruiz", celular: null, cedula: null, cargo: null });
  });
  it("rejects bad data", () => {
    expect(perfilSchema.safeParse({ nombre: "A", celular: "12", cedula: "x" }).success).toBe(false);
  });
});

describe("role escalation requests", () => {
  it("only roles above the current one can be requested", () => {
    expect(rolesSolicitables("usuario")).toEqual(["inspector", "admin", "superadmin"]);
    expect(rolesSolicitables("admin")).toEqual(["superadmin"]);
    expect(rolesSolicitables("superadmin")).toEqual([]);
  });
  it("requires a reason", () => {
    expect(solicitudRolSchema.safeParse({ rol: "inspector", motivo: "" }).success).toBe(false);
    expect(solicitudRolSchema.parse({ rol: "inspector", motivo: " Hago visitas técnicas " })).toEqual({ rol: "inspector", motivo: "Hago visitas técnicas" });
  });
});
