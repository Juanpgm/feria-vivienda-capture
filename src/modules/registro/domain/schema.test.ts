import { describe, expect, it } from "vitest";
import { valido } from "./fixture";
import { registroSchema } from "./schema";

type Entrada = ReturnType<typeof valido>;
/** Field paths that fail for a mutated payload ("" when valid). */
function fallos(mut: (v: Entrada) => void): string[] {
  const v = valido();
  mut(v);
  const r = registroSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}
const set = (o: object, patch: object) => Object.assign(o, patch);

describe("registroSchema", () => {
  it("normalizes and derives on a valid payload", () => {
    const r = registroSchema.parse(valido());
    expect(r.solicitante).toMatchObject({
      nombre_completo: "Ana María Pérez",
      numero_documento: "12345678",
      telefono_1: "+573001234567",
      telefono_2: null,
      correo_solicitante: "ana@correo.com",
      anios_residencia: 2.5,
      nacionalidad: "Colombiana",
    });
    expect(r.composicion).toMatchObject({ rango_tamano_hogar: "4_mas", rango_adulto_mayor: "ninguno", ingreso_hogar_cop: 2_000_000, rango_ingresos_smlmv: "0_4" });
    expect(r.inmueble).toMatchObject({ sector: "urbano", tipo_division: "comuna", direccion_norm: "KR 12 # 5-20", id_barrio_vereda: "0199" });
  });

  it("nationality rules per document type", () => {
    expect(fallos((v) => set(v.solicitante, { codigo_pais_nacionalidad: "VE" }))).toEqual(["solicitante.codigo_pais_nacionalidad"]);
    expect(fallos((v) => set(v.solicitante, { tipo_documento: "ce", codigo_pais_nacionalidad: "VE" }))).toEqual([]);
    expect(fallos((v) => set(v.solicitante, { tipo_documento: "otro", codigo_pais_nacionalidad: "CO" }))).toEqual(["solicitante.tipo_documento_otro"]);
    expect(fallos((v) => set(v.solicitante, { tipo_documento: "otro", tipo_documento_otro: "PEP", codigo_pais_nacionalidad: "CO" }))).toEqual([]);
  });

  it("dates: impossible, future and order", () => {
    expect(fallos((v) => set(v.solicitante, { fecha_nacimiento: "2000-02-30" }))).toContain("solicitante.fecha_nacimiento");
    expect(fallos((v) => set(v.solicitante, { fecha_expedicion_documento: "2999-01-01" }))).toContain("solicitante.fecha_expedicion_documento");
    expect(fallos((v) => set(v.solicitante, { fecha_expedicion_documento: "1980-01-01" }))).toContain("solicitante.fecha_expedicion_documento");
  });

  it("rejects invalid email, phone and non-integer household size", () => {
    expect(fallos((v) => set(v.solicitante, { correo_solicitante: "no-es-correo" }))).toEqual(["solicitante.correo_solicitante"]);
    expect(fallos((v) => set(v.solicitante, { telefono_1: "12345" }))).toEqual(["solicitante.telefono_1"]);
    for (const n of ["2.5", "dos", "", 0, -1]) {
      expect(fallos((v) => set(v.composicion, { cantidad_personas_hogar: n }))).toEqual(["composicion.cantidad_personas_hogar"]);
    }
  });

  it("older adults: count must match the ages, cleared when No", () => {
    const si = { tiene_adulto_mayor: true, cantidad_adultos_mayores: 2 };
    expect(fallos((v) => set(v.composicion, { ...si, adultos_mayores: [{ edad: 70 }] }))).toEqual(["composicion.adultos_mayores"]);
    expect(fallos((v) => set(v.composicion, { ...si, adultos_mayores: [{ edad: 59 }, { edad: 70 }] }))).toEqual(["composicion.adultos_mayores.0.edad"]);
    const r = registroSchema.parse(Object.assign(valido(), { composicion: { ...valido().composicion, ...si, adultos_mayores: [{ edad: 66 }, { edad: 80 }] } }));
    expect(r.composicion).toMatchObject({ rango_adulto_mayor: "mayor_74", cantidad_adultos_mayores: 2 });
    const no = registroSchema.parse(Object.assign(valido(), { composicion: { ...valido().composicion, cantidad_adultos_mayores: 3, adultos_mayores: [{ edad: 70 }] } }));
    expect(no.composicion).toMatchObject({ cantidad_adultos_mayores: null, adultos_mayores: [], rango_adulto_mayor: "ninguno" });
  });

  it("special protection: 'ninguna' is exclusive and a choice is required", () => {
    expect(fallos((v) => set(v.composicion, { condiciones_especiales: ["ninguna", "discapacidad"] }))).toEqual(["composicion.condiciones_especiales"]);
    expect(fallos((v) => set(v.composicion, { condiciones_especiales: [] }))).toEqual(["composicion.condiciones_especiales"]);
    expect(fallos((v) => set(v.composicion, { condiciones_especiales: ["discapacidad", "mujer_cabeza_hogar"] }))).toEqual([]);
  });

  it("income must be numeric COP", () => {
    expect(fallos((v) => set(v.composicion, { ingreso_hogar_cop: "mucho" }))).toEqual(["composicion.ingreso_hogar_cop"]);
    expect(fallos((v) => set(v.composicion, { ingreso_hogar_cop: "$1,500,000" }))).toEqual([]);
  });

  it("inmueble: cascade, fallback text, estrato", () => {
    expect(fallos((v) => set(v.inmueble, { codigo_division: "02" }))).toEqual(["inmueble.id_barrio_vereda"]); // barrio of comuna 01
    expect(fallos((v) => set(v.inmueble, { codigo_division: "99" }))).toEqual(["inmueble.codigo_division"]);
    expect(fallos((v) => set(v.inmueble, { id_barrio_vereda: null }))).toEqual(["inmueble.id_barrio_vereda"]);
    expect(fallos((v) => set(v.inmueble, { id_barrio_vereda: null, barrio_vereda_otro: "Sector X" }))).toEqual([]);
    expect(fallos((v) => set(v.inmueble, { codigo_division: "51", id_barrio_vereda: null, barrio_vereda_otro: "X" }))).toEqual([]);
    // Missing estrato must not hide the cross-field errors.
    expect(fallos((v) => set(v.inmueble, { estrato: "", codigo_division: "", id_barrio_vereda: null }))).toEqual(["inmueble.estrato", "inmueble.codigo_division"]);
    for (const e of [0, 7, 2.5]) expect(fallos((v) => set(v.inmueble, { estrato: e }))).toEqual(["inmueble.estrato"]);
  });

  it("rural division derives sector rural", () => {
    const v = valido();
    set(v.inmueble, { codigo_division: "51", id_barrio_vereda: null, barrio_vereda_otro: "X" });
    expect(registroSchema.parse(v).inmueble.sector).toBe("rural");
  });

  it("riesgo: RUD number or 'no sabe', dictamen otro", () => {
    expect(fallos((v) => set(v.riesgo, { esta_en_rud: true }))).toEqual(["riesgo.numero_rud"]);
    expect(fallos((v) => set(v.riesgo, { esta_en_rud: true, rud_no_sabe: true }))).toEqual([]);
    const v = valido();
    set(v.riesgo, { esta_en_rud: true, rud_no_sabe: true });
    expect(registroSchema.parse(v).riesgo).toMatchObject({ numero_rud: null, rud_no_sabe: true });
    expect(fallos((v) => set(v.riesgo, { dictamen: "otro" }))).toEqual(["riesgo.dictamen_otro"]);
    expect(fallos((v) => set(v.riesgo, { dictamen: "otro", dictamen_otro: "Grietas" }))).toEqual([]);
  });

  it("matricula is optional but must be alphanumeric/hyphen", () => {
    expect(fallos((v) => set(v.titularidad, { numero_matricula_inmobiliaria: "   " }))).toEqual([]);
    expect(fallos((v) => set(v.titularidad, { numero_matricula_inmobiliaria: "370-123456" }))).toEqual([]);
    expect(fallos((v) => set(v.titularidad, { numero_matricula_inmobiliaria: "37 0/1" }))).toEqual(["titularidad.numero_matricula_inmobiliaria"]);
  });

  it("cierre financiero: insurance requires insurer; 'otra' requires text", () => {
    expect(fallos((v) => set(v.cierre_financiero, { tiene_seguro: true }))).toEqual(["cierre_financiero.codigo_aseguradora"]);
    expect(fallos((v) => set(v.cierre_financiero, { tiene_seguro: true, codigo_aseguradora: "otra" }))).toEqual(["cierre_financiero.aseguradora_otra"]);
    expect(fallos((v) => set(v.cierre_financiero, { tiene_seguro: true, codigo_aseguradora: "otra", aseguradora_otra: "X" }))).toEqual([]);
    expect(fallos((v) => set(v.cierre_financiero, { fuentes_financiacion: ["ninguna", "recursos_propios"] }))).toEqual(["cierre_financiero.fuentes_financiacion"]);
  });

  it("under-18 applicant parses (warning is raised by the repo, not a block)", () => {
    expect(fallos((v) => set(v.solicitante, { fecha_nacimiento: "2015-01-01", fecha_expedicion_documento: "2020-01-01" }))).toEqual([]);
  });
});
