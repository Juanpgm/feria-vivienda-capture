import { describe, expect, it } from "vitest";
import { armarDatos, validarSecciones, type Valores } from "./armar";
import { aValores } from "./formulario";
import { moneda } from "./schema";
import { DECLARACION_VERSION } from "./texto";

/** Every titular field is required (decision 2026-11-19). */
const solicitante = {
  nombres: "  ana  MARÍA ", apellidos: "pérez gómez", tipo_documento: "cc", numero_documento: "1.144.555.666",
  fecha_nacimiento: "1985-03-15", telefono: "3001234567", condiciones_especiales: ["ninguna"],
  lugar_expedicion: "76001", fecha_expedicion: "2003-04-01", lugar_nacimiento: "76001", ingreso_mensual: "1000000",
  genero: "cis_femenino", ocupacion: "independiente", direccion: "calle 12 # 5-20", codigo_division: "19", id_barrio_vereda: "1912",
  estrato: "4", anios_residencia: "20", correo: "ana@correo.com", notificacion_electronica: "si", caja_compensacion: "no", sisben: "no",
};
/** Every member field is required too (no phone or email for members). */
const integrante = (extra: Record<string, unknown> = {}) => ({
  nombres_apellidos: "luis pérez", fecha_nacimiento: "2015-06-01", tipo_documento: "ti", numero_documento: "1100000001", parentesco: "hijo",
  estado_civil: "soltero", ocupacion: "estudiante", identidad_genero: "cis_masculino", condiciones_especiales: ["ninguna"], ingresos: "0", ...extra,
});
const base = (extra: Partial<Valores> = {}): Valores => ({
  solicitante: { ...solicitante },
  hogar: { integrantes: [] },
  postulacion: { modalidad: "4", fuentes: [], recursos: {} },
  ...extra,
});

describe("moneda", () => {
  it("normalizes formatted money to integer pesos", () => {
    expect(moneda.parse("1.500.000")).toBe(1500000);
    expect(moneda.parse("$1,500,000")).toBe(1500000);
    expect(moneda.parse("1500000 COP")).toBe(1500000);
    expect(moneda.parse(250000)).toBe(250000);
  });
  it("rejects decimals, text and negatives", () => {
    for (const v of ["1.500,50", "mil", "-5", 3.5]) expect(moneda.safeParse(v).success).toBe(false);
  });
});

describe("solicitante", () => {
  it("normalizes names and document", () => {
    const r = armarDatos(base());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.solicitante.nombres).toBe("Ana María");
    expect(r.datos.solicitante.apellidos).toBe("Pérez Gómez");
    expect(r.datos.solicitante.numero_documento).toBe("1144555666");
    expect(r.datos.solicitante.telefono).toBe("+573001234567");
  });
  it("requires every titular field", () => {
    const e = validarSecciones({ solicitante: {} }, ["solicitante"]);
    const obligatorios = [
      "nombres", "apellidos", "tipo_documento", "numero_documento", "fecha_nacimiento", "telefono", "correo", "lugar_expedicion", "fecha_expedicion",
      "lugar_nacimiento", "ingreso_mensual", "genero", "ocupacion", "direccion", "codigo_division", "id_barrio_vereda", "estrato", "anios_residencia",
      "notificacion_electronica", "caja_compensacion", "sisben", "condiciones_especiales",
    ];
    for (const k of obligatorios) expect(e[`solicitante.${k}`], k).toBeTruthy();
  });
  it("requires the conditional answers that apply", () => {
    const e = validarSecciones(base({ solicitante: { ...solicitante, ocupacion: "empleado", caja_compensacion: "si", sisben: "si", genero: "otro" } }), ["solicitante"]);
    for (const k of ["empresa", "caja_cual", "sisben_grupo", "sisben_subgrupo", "genero_otro"]) expect(e[`solicitante.${k}`], k).toBeTruthy();
  });
  it("requires every member field, but no phone or email", () => {
    const e = validarSecciones(base({ hogar: { integrantes: [{}] } }), ["hogar"]);
    for (const k of ["nombres_apellidos", "fecha_nacimiento", "tipo_documento", "numero_documento", "parentesco", "estado_civil", "ocupacion", "identidad_genero", "condiciones_especiales", "ingresos"])
      expect(e[`hogar.integrantes.0.${k}`], k).toBeTruthy();
    expect(Object.keys(e).some((k) => /telefono|correo/.test(k))).toBe(false);
  });
  it("blocks applicants under 18", () => {
    const e = validarSecciones(base({ solicitante: { ...solicitante, fecha_nacimiento: "2015-01-01" } }), ["solicitante"]);
    expect(e["solicitante.fecha_nacimiento"]).toMatch(/18 años/);
  });
  it("derives catalog names and the normalized address, and rejects a barrio of another comuna", () => {
    const ok = armarDatos(base({ solicitante: { ...solicitante, direccion: "calle 12 # 5-20", codigo_division: "19", id_barrio_vereda: "1912", estrato: "3" } }));
    expect(ok.ok && ok.datos.solicitante.direccion_norm).toBe("CL 12 # 5-20");
    expect(ok.ok && ok.datos.solicitante.nombre_barrio_vereda).toBe("3 de Julio");
    // The estrato comes from the barrio (estrato moda of 3 de Julio), not from what was typed.
    expect(ok.ok && ok.datos.solicitante.estrato).toBe(4);
    const mal = validarSecciones(base({ solicitante: { ...solicitante, codigo_division: "11", id_barrio_vereda: "1912" } }), ["solicitante"]);
    expect(mal["solicitante.id_barrio_vereda"]).toMatch(/no pertenece/);
  });
  it("drops conditional answers that no longer apply", () => {
    const r = armarDatos(base({ solicitante: { ...solicitante, ocupacion: "pensionado", empresa: "ACME", sisben: "no", sisben_grupo: "A", caja_compensacion: "si", caja_cual: "Comfandi" } }));
    expect(r.ok && r.datos.solicitante.empresa).toBeNull();
    expect(r.ok && r.datos.solicitante.sisben_grupo).toBeNull();
    expect(r.ok && r.datos.solicitante.caja_cual).toBe("Comfandi");
  });
});

describe("grupo familiar", () => {
  const nino = integrante();
  it("checks document type against age", () => {
    const e = validarSecciones(base({ hogar: { integrantes: [{ ...nino, tipo_documento: "cc" }] } }), ["hogar"]);
    expect(e["hogar.integrantes.0.tipo_documento"]).toMatch(/menor/i);
  });
  it("rejects repeated documents (between members and with the applicant)", () => {
    const e = validarSecciones(base({ hogar: { integrantes: [nino, { ...nino }, { ...nino, numero_documento: "1144555666" }] } }), ["hogar"]);
    expect(e["hogar.integrantes.1.numero_documento"]).toBeTruthy();
    expect(e["hogar.integrantes.2.numero_documento"]).toBeTruthy();
    expect(e["hogar.integrantes.0.numero_documento"]).toBeUndefined();
  });
  it("sums household income with the applicant's", () => {
    const r = armarDatos(base({ solicitante: { ...solicitante, ingreso_mensual: "1.000.000" }, hogar: { integrantes: [{ ...nino, ingresos: "$500.000" }] } }));
    expect(r.ok && r.datos.hogar.total_ingresos).toBe(1500000);
    expect(r.ok && r.datos.hogar.personas).toBe(2);
  });
});

describe("postulación y cierre financiero", () => {
  it("keeps only selected sources, normalizes amounts and totals them", () => {
    const r = armarDatos(base({
      postulacion: {
        modalidad: "1", fuentes: ["ahorro_programado", "cesantias"],
        recursos: { ahorro_programado: { valor: "2.000.000", entidad: "Banco" }, cesantias: { valor: "1,000,000" }, creditos: { valor: "9" } },
      },
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.postulacion.fuentes).toEqual(["ahorro_programado", "cesantias"]);
    expect(r.datos.postulacion.recursos.creditos).toBeUndefined();
    expect(r.datos.postulacion.total_aportes).toBe(3000000);
    expect(r.datos.postulacion.proyecto).not.toBeNull();
    expect(r.datos.postulacion.obligacion).toBeNull();
  });
  it("reports an invalid amount under its own field", () => {
    const e = validarSecciones(base({ postulacion: { modalidad: "1", fuentes: ["creditos"], recursos: { creditos: { valor: "mucho" } } } }), ["postulacion"]);
    expect(e["postulacion.recursos.creditos.valor"]).toBeTruthy();
  });
  it("requires accepting the sworn declaration", () => {
    expect(validarSecciones({ declaracion: {} }, ["declaracion"])["declaracion.acepta"]).toBeTruthy();
    expect(validarSecciones({ declaracion: { acepta: true, version: DECLARACION_VERSION } }, ["declaracion"])).toEqual({});
  });
});

describe("aValores (staff edit)", () => {
  it("round-trips a stored record back to the same data", () => {
    const valores = base({
      solicitante: { ...solicitante, sisben: "si", sisben_grupo: "B", sisben_subgrupo: "4", estrato: "2", ingreso_mensual: "900000" },
      hogar: { integrantes: [integrante()] },
      postulacion: { modalidad: "10", entidad_acreedora: "fev", saldo_adeudado: "3.000.000", autoriza_giro: true, fuentes: ["creditos"], recursos: { creditos: { valor: "100", entidad: "Banco" } } },
    });
    const a = armarDatos(valores);
    if (!a.ok) throw new Error("should build");
    const b = armarDatos(aValores(a.datos));
    expect(b.ok && b.datos).toEqual(a.datos);
  });
});

describe("faltantes", () => {
  it("lists what validation still needs", () => {
    const r = armarDatos(base({ postulacion: { modalidad: "10", fuentes: [], recursos: {} } }));
    if (!r.ok) throw new Error("should build");
    const rutas = r.faltantes.map((f) => f.ruta);
    expect(rutas.some((r) => r.startsWith("solicitante."))).toBe(false); // titular data is complete by construction
    expect(rutas).toContain("postulacion.entidad_acreedora");
    expect(rutas).toContain("postulacion.autoriza_giro");
  });
  it("is empty for a complete record", () => {
    const r = armarDatos({
      solicitante: {
        ...solicitante, lugar_expedicion: "76001", fecha_expedicion: "2003-04-01", lugar_nacimiento: "76001", ingreso_mensual: "1000000",
        genero: "cis_femenino", ocupacion: "independiente", direccion: "calle 12 # 5-20", codigo_division: "19", id_barrio_vereda: "1912",
        estrato: "2", anios_residencia: "20", notificacion_electronica: "si", caja_compensacion: "no", sisben: "si", sisben_grupo: "A", sisben_subgrupo: "3",
      },
      hogar: { integrantes: [integrante()] },
      postulacion: { modalidad: "1", proyecto_nombre: "Altos", constructora: "C", tipo_vivienda: "vis", valor_vis: "150.000.000", fuentes: ["ahorro_programado"], recursos: { ahorro_programado: { valor: "5000000" } } },
    });
    expect(r.ok && r.faltantes).toEqual([]);
  });
});

describe("tipo de proyecto VIS / VIP", () => {
  const conProyecto = (extra: Record<string, unknown>) =>
    armarDatos(base({ postulacion: { modalidad: "1", proyecto_nombre: "Altos", constructora: "C", fuentes: [], recursos: {}, ...extra } }));
  it("keeps only the value of the chosen type; the other one is 0", () => {
    const r = conProyecto({ tipo_vivienda: "vip", valor_vis: "999", valor_vip: "90.000.000" });
    expect(r.ok && r.datos.postulacion.proyecto).toMatchObject({ tipo_vivienda: "vip", valor_vis: 0, valor_vip: 90000000 });
  });
  it("asks first for the type, then for its value", () => {
    const sinTipo = conProyecto({});
    expect(sinTipo.ok && sinTipo.faltantes.map((f) => f.ruta)).toContain("postulacion.tipo_vivienda");
    const sinValor = conProyecto({ tipo_vivienda: "vis" });
    expect(sinValor.ok && sinValor.faltantes.map((f) => f.ruta)).toContain("postulacion.valor_vis");
  });
});

describe("integrantes: cónyuge y condiciones", () => {
  const conyuge = integrante({ nombres_apellidos: "maría lópez", fecha_nacimiento: "1987-02-01", tipo_documento: "cc", numero_documento: "1100000002", parentesco: "conyuge", estado_civil: "soltero", ocupacion: "hogar", identidad_genero: "cis_femenino" });
  it("a spouse or partner is stored as married or in a marital union", () => {
    const r = armarDatos(base({ hogar: { integrantes: [conyuge] } }));
    expect(r.ok && r.datos.hogar.integrantes[0].estado_civil).toBe("casado_union");
  });
  it("members take several special conditions; «Ninguna» is exclusive", () => {
    const r = armarDatos(base({ hogar: { integrantes: [{ ...conyuge, condiciones_especiales: ["discapacidad", "campesino"] }] } }));
    expect(r.ok && r.datos.hogar.integrantes[0].condiciones_especiales).toEqual(["discapacidad", "campesino"]);
    const e = validarSecciones(base({ hogar: { integrantes: [{ ...conyuge, condiciones_especiales: ["ninguna", "campesino"] }] } }), ["hogar"]);
    expect(e["hogar.integrantes.0.condiciones_especiales"]).toMatch(/Ninguna/);
  });
  it("heterosexual is not a gender identity option (cisgénero covers it)", async () => {
    const { IDENTIDADES_GENERO } = await import("./catalogos");
    expect(Object.keys(IDENTIDADES_GENERO)).not.toContain("heterosexual");
  });
});
