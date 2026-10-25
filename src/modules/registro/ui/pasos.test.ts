import { describe, expect, it } from "vitest";
import { estadoPaso, PASOS, validarPaso, type Valores } from "./pasos";

const [hogar, composicion, proteccion] = PASOS;

const solicitante = {
  nombre_completo: "ana maria", tipo_documento: "cc", tipo_documento_otro: "", codigo_pais_nacionalidad: "CO",
  numero_documento: "1.234.567", fecha_expedicion_documento: "2010-05-01", telefono_1: "3001234567", telefono_2: "",
  correo_solicitante: "a@b.co", anios_residencia: "2,5", fecha_nacimiento: "1990-01-02", estado_civil: "soltero",
};
const comp = { cantidad_personas_hogar: "3", tiene_adulto_mayor: "no", cantidad_adultos_mayores: "", adultos_mayores: [], condiciones_especiales: ["ninguna"], ingreso_hogar_cop: "1.500.000" };

describe("validarPaso", () => {
  it("accepts a valid hogar step", async () => {
    expect(await validarPaso(hogar, { solicitante } as Valores)).toEqual({});
  });
  it("reports CC with a foreign nationality on the nationality field", async () => {
    const e = await validarPaso(hogar, { solicitante: { ...solicitante, codigo_pais_nacionalidad: "VE" } } as Valores);
    expect(Object.keys(e)).toEqual(["solicitante.codigo_pais_nacionalidad"]);
  });
  it("asks for ages under .root and ignores fields of other steps", async () => {
    const v = { composicion: { ...comp, tiene_adulto_mayor: "si", cantidad_adultos_mayores: "2", adultos_mayores: [{ edad: "70" }], condiciones_especiales: [] } } as Valores;
    expect(Object.keys(await validarPaso(composicion, v))).toEqual(["composicion.adultos_mayores.root"]);
  });
  it("step 3 enforces the exclusive Ninguna rule without needing step 2 data", async () => {
    const vacio = { composicion: { condiciones_especiales: ["ninguna", "mujer_cabeza_hogar"] } } as Valores;
    expect(Object.keys(await validarPaso(proteccion, vacio))).toEqual(["composicion.condiciones_especiales"]);
    expect(await validarPaso(proteccion, { composicion: { condiciones_especiales: ["ninguna"] } } as Valores)).toEqual({});
  });
});

describe("estadoPaso", () => {
  it("derives the state from the current step and the marks", () => {
    const m = { a: "completo", b: "errores" } as const;
    expect(estadoPaso("c", "c", m)).toBe("en_curso");
    expect(estadoPaso("a", "c", m)).toBe("completo");
    expect(estadoPaso("b", "c", m)).toBe("con_errores");
    expect(estadoPaso("d", "c", m)).toBe("pendiente");
  });
});
