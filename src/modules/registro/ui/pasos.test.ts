import { describe, expect, it } from "vitest";
import { estadoPaso, fotosHabilitadas, PASOS, validarPaso, type Valores } from "./pasos";

const paso = (id: string) => PASOS.find((p) => p.id === id)!;

const solicitante = {
  primer_nombre: "ana", segundo_nombre: "", primer_apellido: "maria", segundo_apellido: "", tipo_documento: "cc", tipo_documento_otro: "", codigo_pais_nacionalidad: "CO",
  numero_documento: "1.234.567", fecha_expedicion_documento: "2010-05-01", telefono_1: "3001234567", telefono_2: "",
  correo_solicitante: "a@b.co", anios_residencia: "2,5", fecha_nacimiento: "1990-01-02", estado_civil: "soltero",
};
const solicitanteHogar = paso("solicitante");
const hogarPaso = paso("hogar");
const comp = { cantidad_personas_hogar: "3", tiene_adulto_mayor: "no", cantidad_adultos_mayores: "", adultos_mayores: [], condiciones_especiales: ["ninguna"], ingreso_hogar_cop: "1.500.000" };

describe("validarPaso", () => {
  it("accepts a valid hogar step", async () => {
    expect(await validarPaso(solicitanteHogar, { solicitante } as Valores)).toEqual({});
  });
  it("reports CC with a foreign nationality on the nationality field", async () => {
    const e = await validarPaso(solicitanteHogar, { solicitante: { ...solicitante, codigo_pais_nacionalidad: "VE" } } as Valores);
    expect(Object.keys(e)).toEqual(["solicitante.codigo_pais_nacionalidad"]);
  });
  it("asks for ages under .root and ignores fields of other sections", async () => {
    const v = { composicion: { ...comp, tiene_adulto_mayor: "si", cantidad_adultos_mayores: "2", adultos_mayores: [{ edad: "70" }] } } as Valores;
    expect(Object.keys(await validarPaso(hogarPaso, v))).toEqual(["composicion.adultos_mayores.root"]);
  });
  it("blocks applicants under 18 on the birth date", async () => {
    const e = await validarPaso(solicitanteHogar, { solicitante: { ...solicitante, fecha_nacimiento: "2015-01-01", fecha_expedicion_documento: "2020-01-01" } } as Valores);
    expect(Object.keys(e)).toEqual(["solicitante.fecha_nacimiento"]);
  });
  it("blocks more older adults than household members, with the message on the count field", async () => {
    const v = { composicion: { ...comp, cantidad_personas_hogar: "2", tiene_adulto_mayor: "si", cantidad_adultos_mayores: "3", adultos_mayores: [{ edad: "70" }, { edad: "71" }, { edad: "72" }] } } as Valores;
    expect(await validarPaso(hogarPaso, v)).toEqual({ "composicion.cantidad_adultos_mayores": "Los adultos mayores no pueden ser más que las personas del hogar" });
  });
  it("the merged hogar step enforces the exclusive Ninguna rule and the household rules together, without relleno", async () => {
    const mala = { composicion: { ...comp, condiciones_especiales: ["ninguna", "mujer_cabeza_hogar"] } } as Valores;
    expect(Object.keys(await validarPaso(hogarPaso, mala))).toEqual(["composicion.condiciones_especiales"]);
    expect(await validarPaso(hogarPaso, { composicion: comp } as Valores)).toEqual({});
    const dos = { composicion: { ...comp, cantidad_personas_hogar: "", ingreso_hogar_cop: "", condiciones_especiales: [] } } as Valores;
    expect(Object.keys(await validarPaso(hogarPaso, dos)).sort()).toEqual(["composicion.cantidad_personas_hogar", "composicion.condiciones_especiales", "composicion.ingreso_hogar_cop"]);
  });
});

describe("merged steps: vivienda, cierre financiero, autorizacion", () => {
  const tit = { tipo_titularidad: "poseedor_legitimo", numero_matricula_inmobiliaria: "", es_unica_propiedad: "si", excepcion_unica_propiedad: "" };
  const rie = { esta_en_rud: "no", numero_rud: "", rud_no_sabe: false, dictamen: "demolido", dictamen_otro: "" };
  const inm = { direccion: "Calle 5 # 10-20", codigo_division: "01", id_barrio_vereda: "0199", estrato: "3" };
  /** The vivienda step with valid sections, overridden per case; returns the offending field paths. */
  const vivienda = async (o: { inmueble?: object; riesgo?: object; titularidad?: object } = {}) =>
    Object.keys(await validarPaso(paso("vivienda"), { inmueble: { ...inm, ...o.inmueble }, riesgo: { ...rie, ...o.riesgo }, titularidad: { ...tit, ...o.titularidad } } as Valores));

  it("vivienda validates the union of inmueble, riesgo and titularidad", async () => {
    expect(await vivienda()).toEqual([]);
    expect(await vivienda({ inmueble: { estrato: "" }, riesgo: { dictamen: "" }, titularidad: { tipo_titularidad: "" } })).toEqual([
      "inmueble.estrato", "riesgo.dictamen", "titularidad.tipo_titularidad",
    ]);
    const vacio = Object.keys(await validarPaso(paso("vivienda"), {} as Valores));
    expect(vacio.some((k) => k.startsWith("inmueble."))).toBe(true);
    expect(vacio.some((k) => k.startsWith("riesgo."))).toBe(true);
    expect(vacio.some((k) => k.startsWith("titularidad."))).toBe(true);
  });
  it("inmueble: a barrio of another comuna is refused; free text is not accepted", async () => {
    expect(await vivienda({ inmueble: { codigo_division: "02" } })).toEqual(["inmueble.id_barrio_vereda"]);
    expect(await vivienda({ inmueble: { id_barrio_vereda: "", barrio_vereda_otro: "Mi barrio" } })).toEqual(["inmueble.id_barrio_vereda"]);
    expect(await vivienda({ inmueble: { estrato: "" } })).toEqual(["inmueble.estrato"]);
  });
  it("riesgo: RUD si needs a number or 'No lo sabe'; no ignores both; dictamen otro needs text", async () => {
    const si = { esta_en_rud: "si", dictamen: "demolido" };
    expect(await vivienda({ riesgo: si })).toEqual(["riesgo.numero_rud"]);
    expect(await vivienda({ riesgo: { ...si, rud_no_sabe: true } })).toEqual([]);
    expect(await vivienda({ riesgo: { rud_no_sabe: false } })).toEqual([]);
    expect(await vivienda({ riesgo: { ...si, numero_rud: "12", dictamen: "otro" } })).toEqual(["riesgo.dictamen_otro"]);
  });
  it("titularidad: matricula is optional but must be alphanumeric", async () => {
    expect(await vivienda({ titularidad: { numero_matricula_inmobiliaria: "50C 123 !" } })).toEqual(["titularidad.numero_matricula_inmobiliaria"]);
  });
  it("titularidad: unica propiedad is required; No needs an exception, Si ignores a stale one", async () => {
    expect(await vivienda({ titularidad: { es_unica_propiedad: "" } })).toEqual(["titularidad.es_unica_propiedad"]);
    expect(await vivienda({ titularidad: { es_unica_propiedad: "no" } })).toEqual(["titularidad.excepcion_unica_propiedad"]);
    expect(await vivienda({ titularidad: { es_unica_propiedad: "no", excepcion_unica_propiedad: "otras_propiedades_destruidas" } })).toEqual([]);
    expect(await vivienda({ titularidad: { es_unica_propiedad: "si", excepcion_unica_propiedad: "basura" } })).toEqual([]);
  });
  it("cierre financiero: insurance si needs an insurer, 'otra' needs a name; Ninguna is exclusive", async () => {
    const c = { fuentes_financiacion: ["recursos_propios"], tiene_seguro: "si", codigo_aseguradora: "", aseguradora_otra: "" };
    const v = (x: object) => ({ cierre_financiero: { ...c, ...x } }) as Valores;
    expect(Object.keys(await validarPaso(paso("financiero"), v({})))).toEqual(["cierre_financiero.codigo_aseguradora"]);
    expect(Object.keys(await validarPaso(paso("financiero"), v({ codigo_aseguradora: "otra" })))).toEqual(["cierre_financiero.aseguradora_otra"]);
    expect(await validarPaso(paso("financiero"), v({ tiene_seguro: "no" }))).toEqual({});
    expect(Object.keys(await validarPaso(paso("financiero"), v({ tiene_seguro: "no", fuentes_financiacion: ["ninguna", "recursos_propios"] })))).toEqual(["cierre_financiero.fuentes_financiacion"]);
  });
  it("autorizacion: the consent and both photos are required together", async () => {
    const ok = { consentimiento: { acepta_tratamiento: true, acepta_datos_sensibles: false, version: "2026-10-v1" }, documentos: { documento_frente: "capturada", documento_reverso: "capturada" } };
    expect(await validarPaso(paso("autorizacion"), ok as Valores)).toEqual({});
    const e = await validarPaso(paso("autorizacion"), { consentimiento: { acepta_tratamiento: false, acepta_datos_sensibles: false }, documentos: { documento_frente: "capturada", documento_reverso: "" } } as Valores);
    expect(Object.keys(e)).toEqual(["consentimiento.acepta_tratamiento", "documentos.documento_reverso"]);
  });
});

describe("structure of the 6 steps", () => {
  it("has six distinct steps and every field is owned by exactly one step", () => {
    expect(PASOS.map((p) => p.id)).toEqual(["solicitante", "hogar", "vivienda", "financiero", "autorizacion", "revision"]);
    const claves = PASOS.flatMap((p) => p.partes.flatMap((x) => x.campos.map((c) => `${x.seccion}.${c}`)));
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe("fotosHabilitadas", () => {
  it("photos stay locked until the treatment of personal data is authorized", () => {
    expect(fotosHabilitadas({})).toBe(false);
    expect(fotosHabilitadas({ consentimiento: { acepta_tratamiento: false } })).toBe(false);
    expect(fotosHabilitadas({ consentimiento: { acepta_tratamiento: true, acepta_datos_sensibles: false } })).toBe(true);
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
