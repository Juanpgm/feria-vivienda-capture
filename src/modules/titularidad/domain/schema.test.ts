import { describe, expect, it } from "vitest";
import { titularidadSchema } from "./schema";

describe("titularidadSchema: única propiedad depends on who answers", () => {
  it("a tenant is never asked: stored as false with no exception, whatever the payload says", () => {
    for (const extra of [{}, { es_unica_propiedad: true }, { es_unica_propiedad: false, excepcion_unica_propiedad: "otra", excepcion_otra: "x" }]) {
      const r = titularidadSchema.parse({ tipo_titularidad: "arrendatario", ...extra });
      expect(r).toMatchObject({ es_unica_propiedad: false, excepcion_unica_propiedad: null, excepcion_otra: null });
    }
  });
  it("an owner must answer, and a No needs the exception (previous behaviour)", () => {
    expect(titularidadSchema.safeParse({ tipo_titularidad: "propietario_clt" }).error?.issues[0]).toMatchObject({ path: ["es_unica_propiedad"], message: "Seleccione Sí o No" });
    expect(titularidadSchema.safeParse({ tipo_titularidad: "propietario_clt", es_unica_propiedad: false }).error?.issues[0].path).toEqual(["excepcion_unica_propiedad"]);
    expect(titularidadSchema.parse({ tipo_titularidad: "propietario_clt", es_unica_propiedad: true })).toMatchObject({ es_unica_propiedad: true, excepcion_unica_propiedad: null });
    expect(titularidadSchema.parse({ tipo_titularidad: "propietario_clt", es_unica_propiedad: false, excepcion_unica_propiedad: "otras_propiedades_destruidas" })).toMatchObject({
      es_unica_propiedad: false,
      excepcion_unica_propiedad: "otras_propiedades_destruidas",
    });
  });
});
