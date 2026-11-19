import { describe, expect, it } from "vitest";
import { armarDatos, validarSecciones, type Valores } from "./armar";
import { moneda } from "./schema";
import { DECLARACION_VERSION } from "./texto";

const solicitante = {
  nombres: "  ana  MARÍA ", apellidos: "pérez gómez", tipo_documento: "cc", numero_documento: "1.144.555.666",
  fecha_nacimiento: "1985-03-15", telefono: "3001234567", condiciones_especiales: [],
};
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
  it("creates with only the essentials and normalizes names and document", () => {
    const r = armarDatos(base());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.solicitante.nombres).toBe("Ana María");
    expect(r.datos.solicitante.apellidos).toBe("Pérez Gómez");
    expect(r.datos.solicitante.numero_documento).toBe("1144555666");
    expect(r.datos.solicitante.telefono).toBe("+573001234567");
    expect(r.datos.solicitante.direccion).toBeNull();
  });
  it("requires the essentials", () => {
    const e = validarSecciones({ solicitante: {} }, ["solicitante"]);
    for (const k of ["nombres", "apellidos", "tipo_documento", "numero_documento", "fecha_nacimiento", "telefono"]) expect(e[`solicitante.${k}`]).toBeTruthy();
  });
  it("blocks applicants under 18", () => {
    const e = validarSecciones(base({ solicitante: { ...solicitante, fecha_nacimiento: "2015-01-01" } }), ["solicitante"]);
    expect(e["solicitante.fecha_nacimiento"]).toMatch(/18 años/);
  });
  it("derives catalog names and the normalized address, and rejects a barrio of another comuna", () => {
    const ok = armarDatos(base({ solicitante: { ...solicitante, direccion: "calle 12 # 5-20", codigo_division: "19", id_barrio_vereda: "1912", estrato: "3" } }));
    expect(ok.ok && ok.datos.solicitante.direccion_norm).toBe("CL 12 # 5-20");
    expect(ok.ok && ok.datos.solicitante.nombre_barrio_vereda).toBe("3 de Julio");
    expect(ok.ok && ok.datos.solicitante.estrato).toBe(3);
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
  const nino = { nombres_apellidos: "luis pérez", fecha_nacimiento: "2015-06-01", tipo_documento: "ti", numero_documento: "1100000001", ingresos: "0" };
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

describe("faltantes", () => {
  it("lists what validation still needs", () => {
    const r = armarDatos(base({ postulacion: { modalidad: "10", fuentes: [], recursos: {} } }));
    if (!r.ok) throw new Error("should build");
    const rutas = r.faltantes.map((f) => f.ruta);
    expect(rutas).toContain("solicitante.direccion");
    expect(rutas).toContain("postulacion.entidad_acreedora");
    expect(rutas).toContain("postulacion.autoriza_giro");
  });
  it("is empty for a complete record", () => {
    const r = armarDatos({
      solicitante: {
        ...solicitante, lugar_expedicion: "cali", fecha_expedicion: "2003-04-01", lugar_nacimiento: "cali", ingreso_mensual: "1000000",
        genero: "cis_femenino", ocupacion: "independiente", direccion: "calle 12 # 5-20", codigo_division: "19", id_barrio_vereda: "1912",
        estrato: "2", anios_residencia: "20", notificacion_electronica: "si", caja_compensacion: "no", sisben: "si", sisben_grupo: "A", sisben_subgrupo: "3",
      },
      hogar: { integrantes: [{ nombres_apellidos: "luis pérez", fecha_nacimiento: "2015-06-01", tipo_documento: "ti", numero_documento: "1100000001", parentesco: "hijo", ingresos: "0" }] },
      postulacion: { modalidad: "1", proyecto_nombre: "Altos", constructora: "C", valor_vis: "150.000.000", fuentes: ["ahorro_programado"], recursos: { ahorro_programado: { valor: "5000000" } } },
    });
    expect(r.ok && r.faltantes).toEqual([]);
  });
});
