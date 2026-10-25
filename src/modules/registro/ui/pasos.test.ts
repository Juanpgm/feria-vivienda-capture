import { describe, expect, it } from "vitest";
import { estadoPaso, PASOS, validarPaso, type Valores } from "./pasos";

const [hogar, composicion, proteccion] = PASOS;
const paso = (id: string) => PASOS.find((p) => p.id === id)!;

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

describe("pasos 4-7", () => {
  const inm = { direccion: "Calle 5 # 10-20", codigo_division: "01", id_barrio_vereda: "0199", barrio_no_listado: false, barrio_vereda_otro: "", estrato: "3" };
  it("inmueble: a barrio of another comuna is refused; 'not listed' needs the free text", async () => {
    expect(await validarPaso(paso("inmueble"), { inmueble: inm } as Valores)).toEqual({});
    const otra = await validarPaso(paso("inmueble"), { inmueble: { ...inm, codigo_division: "02" } } as Valores);
    expect(Object.keys(otra)).toEqual(["inmueble.id_barrio_vereda"]);
    const sinTexto = { ...inm, barrio_no_listado: true, id_barrio_vereda: "0199" };
    expect(Object.keys(await validarPaso(paso("inmueble"), { inmueble: sinTexto } as Valores))).toEqual(["inmueble.id_barrio_vereda"]);
    expect(await validarPaso(paso("inmueble"), { inmueble: { ...sinTexto, barrio_vereda_otro: "Mi barrio" } } as Valores)).toEqual({});
  });
  it("inmueble: empty estrato asks for a selection", async () => {
    expect(Object.keys(await validarPaso(paso("inmueble"), { inmueble: { ...inm, estrato: "" } } as Valores))).toEqual(["inmueble.estrato"]);
  });
  it("riesgo: RUD si needs a number or 'No lo sabe'; no ignores both; dictamen otro needs text", async () => {
    const r = { esta_en_rud: "si", numero_rud: "", rud_no_sabe: false, dictamen: "demolido", dictamen_otro: "" };
    expect(Object.keys(await validarPaso(paso("riesgo"), { riesgo: r } as Valores))).toEqual(["riesgo.numero_rud"]);
    expect(await validarPaso(paso("riesgo"), { riesgo: { ...r, rud_no_sabe: true } } as Valores)).toEqual({});
    expect(await validarPaso(paso("riesgo"), { riesgo: { ...r, esta_en_rud: "no", rud_no_sabe: false } } as Valores)).toEqual({});
    expect(Object.keys(await validarPaso(paso("riesgo"), { riesgo: { ...r, numero_rud: "12", dictamen: "otro" } } as Valores))).toEqual(["riesgo.dictamen_otro"]);
  });
  it("titularidad: matricula is optional but must be alphanumeric", async () => {
    expect(await validarPaso(paso("titularidad"), { titularidad: { tipo_titularidad: "poseedor_legitimo", numero_matricula_inmobiliaria: "" } } as Valores)).toEqual({});
    const e = await validarPaso(paso("titularidad"), { titularidad: { tipo_titularidad: "propietario_clt", numero_matricula_inmobiliaria: "50C 123 !" } } as Valores);
    expect(Object.keys(e)).toEqual(["titularidad.numero_matricula_inmobiliaria"]);
  });
  it("cierre financiero: insurance si needs an insurer, 'otra' needs a name; Ninguna is exclusive", async () => {
    const c = { fuentes_financiacion: ["recursos_propios"], tiene_seguro: "si", codigo_aseguradora: "", aseguradora_otra: "" };
    const v = (x: object) => ({ cierre_financiero: { ...c, ...x } }) as Valores;
    expect(Object.keys(await validarPaso(paso("financiero"), v({})))).toEqual(["cierre_financiero.codigo_aseguradora"]);
    expect(Object.keys(await validarPaso(paso("financiero"), v({ codigo_aseguradora: "otra" })))).toEqual(["cierre_financiero.aseguradora_otra"]);
    expect(await validarPaso(paso("financiero"), v({ tiene_seguro: "no" }))).toEqual({});
    expect(Object.keys(await validarPaso(paso("financiero"), v({ tiene_seguro: "no", fuentes_financiacion: ["ninguna", "recursos_propios"] })))).toEqual(["cierre_financiero.fuentes_financiacion"]);
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
