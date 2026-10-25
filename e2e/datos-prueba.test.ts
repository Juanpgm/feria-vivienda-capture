// Unit check (vitest, no browser): the e2e datasets must agree with the real domain schemas, so a drift
// between the fixtures and the app is caught without needing a login.
import { describe, expect, it } from "vitest";
import { composicionSchema } from "@/modules/composicion/domain/schema";
import { hogarSchema } from "@/modules/hogar/domain/schema";
import { PASOS, validarPaso, type Valores } from "@/modules/registro/ui/pasos";
import { fechaBogota } from "@/shared/tiempo";
import { evaluarRegistro } from "@/modules/registro/ui/datosResumen";
import { DICTAMENES, TITULARIDADES } from "@/shared/constantes";
import { aValores, condicionesFinales, generarCasos, generarCasosInvalidos, ETIQUETA_RANGO } from "./datos-prueba";

const hoy = fechaBogota();
const casos = generarCasos(hoy);

describe("datos de prueba e2e", () => {
  it("has at least 25 unique valid cases covering every document type", () => {
    expect(casos.length).toBeGreaterThanOrEqual(25);
    expect(new Set(casos.map((c) => c.clave)).size).toBe(casos.length);
    expect(new Set(casos.map((c) => c.solicitante.documento)).size).toBe(casos.length);
    expect(new Set(casos.map((c) => c.solicitante.tipoDocumento))).toEqual(new Set(["cc", "ce", "otro"]));
  });

  it.each(casos.map((c) => [c.clave, c] as const))("%s validates in steps 1-3 and derives the expected values", async (_k, c) => {
    const v = aValores(c) as unknown as Valores;
    for (const paso of PASOS) expect(await validarPaso(paso, v)).toEqual({});

    const h = hogarSchema.parse(v.solicitante);
    expect(h.nombre_completo).toBe(c.esperado.nombre);
    expect(h.numero_documento).toBe(c.esperado.documento);
    expect(h.telefono_1).toBe(c.esperado.telefono1);
    expect(h.telefono_2).toBe(c.esperado.telefono2);
    expect(h.correo_solicitante).toBe(c.esperado.correo);
    expect(String(h.anios_residencia)).toBe(c.esperado.anios);
    expect(h.nacionalidad).toBe(c.esperado.nacionalidad);

    const si = c.composicion.adultoMayor === "si";
    const comp = composicionSchema.parse({
      ...v.composicion,
      tiene_adulto_mayor: si,
      cantidad_adultos_mayores: si ? v.composicion.cantidad_adultos_mayores : undefined,
      adultos_mayores: si ? v.composicion.adultos_mayores : undefined,
    });
    expect(comp.ingreso_hogar_cop).toBe(c.esperado.ingresoCop);
    expect(comp.rango_ingresos_smlmv).toBe(c.esperado.rango);
    expect(ETIQUETA_RANGO[comp.rango_ingresos_smlmv]).toBeTruthy();
    expect(comp.rango_tamano_hogar).toBe(c.esperado.bandaHogar);
    expect(comp.rango_adulto_mayor).toBe(c.esperado.bandaAdultoMayor);
    expect(comp.condiciones_especiales).toEqual(c.esperado.condicionesFinales);
  });

  it("steps 4-7 datasets parse with the real schemas and the declared catalog labels", async () => {
    for (const c of casos) {
      const v = aValores(c) as unknown as Valores;
      const inm = (await evaluarRegistro(v)).inmueble;
      if (!inm.ok) throw new Error(c.clave);
      const d = inm.datos as { nombre_barrio_vereda: string | null; barrio_vereda_otro: string | null; sector: string; nombre_division: string };
      const x = c.extra.vivienda;
      expect(d.sector, c.clave).toBe(x.division!.sector.toLowerCase());
      expect(d.nombre_barrio_vereda ?? d.barrio_vereda_otro, c.clave).toBe(x.lugar?.nombre ?? x.barrioOtro);
      expect(x.division!.etiqueta.endsWith(d.nombre_division), c.clave).toBe(true);
    }
  });

  it("covers every option of steps 4-7 in at least 20 valid cases", () => {
    const ex = casos.map((c) => c.extra);
    expect(casos.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ex.map((e) => e.vivienda.estrato))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(new Set(ex.map((e) => e.vivienda.division!.sector))).toEqual(new Set(["Urbano", "Rural"]));
    expect(ex.some((e) => e.vivienda.barrioOtro)).toBe(true);
    expect(new Set(ex.map((e) => e.riesgo.dictamen))).toEqual(new Set(Object.keys(DICTAMENES)));
    expect(new Set(ex.map((e) => (e.riesgo.rud === "no" ? "no" : e.riesgo.noSabe ? "no_sabe" : "numero")))).toEqual(new Set(["no", "no_sabe", "numero"]));
    expect(new Set(ex.map((e) => e.titularidad.tipo))).toEqual(new Set(Object.keys(TITULARIDADES)));
    expect(ex.some((e) => e.titularidad.matricula) && ex.some((e) => !e.titularidad.matricula)).toBe(true);
    expect(ex.some((e) => e.financiero.seguro === "no") && ex.some((e) => e.financiero.aseguradora?.codigo === "otra")).toBe(true);
    expect(ex.some((e) => condicionesFinales(e.financiero.fuentes).includes("ninguna"))).toBe(true);
    expect(ex.some((e) => condicionesFinales(e.financiero.fuentes).length > 1)).toBe(true);
  });

  it("covers every income bracket, both edges, household band and older-adult band", () => {
    const ing = new Set(casos.map((c) => c.esperado.rango));
    expect(ing).toEqual(new Set(["0_4", "4_5_5", "mas_5_5"]));
    expect(new Set(casos.map((c) => c.esperado.bandaHogar)).size).toBe(3);
    expect(new Set(casos.map((c) => c.esperado.bandaAdultoMayor)).size).toBe(3);
    expect(casos.some((c) => c.esperado.menorDeEdad)).toBe(true);
  });

  it.each(generarCasosInvalidos(hoy).map((c) => [c.clave, c] as const))("%s is refused at its step with the expected messages", async (_k, c) => {
    const v = aValores(c) as unknown as Valores;
    for (const paso of PASOS.slice(0, c.paso - 1)) expect(await validarPaso(paso, v)).toEqual({});
    const errores = Object.values(await validarPaso(PASOS[c.paso - 1], v));
    for (const m of c.mensajes) expect(errores).toContain(m);
  });
});
