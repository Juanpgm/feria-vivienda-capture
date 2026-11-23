import { describe, expect, it } from "vitest";
import { armarDatos, type Valores } from "./armar";
import { celda, operacionesFormato, type Operacion } from "./formatoPdf";

const valores: Valores = {
  solicitante: {
    nombres: "ana maría", apellidos: "pérez gómez", tipo_documento: "cc", numero_documento: "1144555666", fecha_nacimiento: "1985-03-15",
    telefono: "3001234567", condiciones_especiales: ["cabeza_hogar", "victima_conflicto"], lugar_expedicion: "76001", fecha_expedicion: "2003-04-01",
    lugar_nacimiento: "76001", ingreso_mensual: "1300000", genero: "cis_femenino", ocupacion: "independiente", direccion: "calle 12 # 5-20",
    codigo_division: "19", id_barrio_vereda: "1912", estrato: "4", anios_residencia: "20", correo: "ana@correo.com", notificacion_electronica: "si",
    caja_compensacion: "no", sisben: "si", sisben_grupo: "B", sisben_subgrupo: "4",
  },
  hogar: {
    integrantes: [
      {
        nombres_apellidos: "luis pérez", fecha_nacimiento: "2015-06-01", tipo_documento: "ti", numero_documento: "1100000001", parentesco: "hijo",
        estado_civil: "soltero", ocupacion: "estudiante", identidad_genero: "cis_masculino", condiciones_especiales: ["ninguna"], ingresos: "0",
      },
    ],
  },
  postulacion: {
    modalidad: "1", proyecto_nombre: "Altos del Río", constructora: "Constructora X", tipo_vivienda: "vis", valor_vis: "150000000",
    fuentes: ["ahorro_programado"], recursos: { ahorro_programado: { valor: "5000000", entidad: "Banco Uno" } },
  },
};

function datos() {
  const r = armarDatos(valores);
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r.datos;
}
const validacion = { funcionario_nombre: "Pedro Funcionario", validado_en: "2026-11-21T10:30:00.000-05:00", folios_anexos: 7 };
const ops = operacionesFormato({ ...datos(), radicado: "PSE-000123", validacion });
const textos = (o: Operacion[]) => o.filter((x) => x.tipo === "texto").map((x) => x.texto);
const en = (rango: string, o = ops) => {
  const c = celda(rango);
  return o.filter((x) => x.tipo === "texto" && x.pagina === c.pagina && x.x >= c.x - 1 && x.x < c.x + c.w && x.y >= c.y - 1 && x.y < c.y + c.h).map((x) => (x as { texto: string }).texto);
};
const marcas = ops.filter((x) => x.tipo === "marca");

describe("celda", () => {
  it("maps Excel ranges onto the printed template (calibrated against the Excel export)", () => {
    // A22 and R31 were filled in a calibration export: page 1 rects (20.28, 371.57)-(43.68, 382.01) and (526.30, 464.47)-(551.02, 474.91).
    const a = celda("A22");
    expect([a.pagina, a.x, a.y, a.x + a.w, a.y + a.h].map((v) => Math.round(v))).toEqual([0, 20, 372, 44, 382]);
    const r = celda("R31");
    expect([r.x, r.y, r.x + r.w, r.y + r.h].map((v) => Math.round(v))).toEqual([526, 464, 551, 475]);
    // Rows 52+ print on page 2, under the repeated header.
    const t = celda("A52");
    expect(t.pagina).toBe(1);
    expect(Math.round(t.y)).toBe(104);
  });
});

describe("operacionesFormato", () => {
  it("prints the radicado and the applicant's data in their cells", () => {
    expect(en("K5:T5")).toEqual(["PSE-000123"]);
    expect(en("A7:I7")).toEqual(["Ana María"]);
    expect(en("J7:T7")).toEqual(["Pérez Gómez"]);
    expect(en("C8:F9")).toEqual(["1144555666"]);
    expect([...en("Q9"), ...en("R9:S9"), ...en("T9")]).toEqual(["01", "04", "2003"]);
    expect([...en("C11"), ...en("D11"), ...en("E11")]).toEqual(["15", "03", "1985"]);
    expect(en("R10:T11")).toEqual(["$ 1.300.000"]);
    expect(en("O13:T13")).toEqual(["3001234567"]);
    expect(en("O16:P16")).toEqual(["B"]);
    expect(en("S16:T16")).toEqual(["4"]);
  });

  it("marks the chosen options with an X: gender, occupation, SI/NO answers, special conditions and modality", () => {
    expect(marcas).toContainEqual(expect.objectContaining({ pagina: 0, x: 115.9, y: 198 })); // Cisg. Femenino
    expect(marcas).toContainEqual(expect.objectContaining({ x: 327.1, y: 197.1 })); // Independiente
    expect(marcas).toContainEqual(expect.objectContaining({ x: 437.6, y: 243.2 })); // notificación electrónica SI
    expect(marcas).toContainEqual(expect.objectContaining({ x: 76.8, y: 268.4 })); // caja NO
    expect(marcas).toContainEqual(expect.objectContaining({ x: 291.3, y: 257.4 })); // sisbén SI
    const dentro = (rango: string) => {
      const c = celda(rango);
      return marcas.some((m) => m.pagina === c.pagina && m.x > c.x && m.x < c.x + c.w && m.y > c.y && m.y < c.y + c.h);
    };
    expect(dentro("G17:H17")).toBe(true); // cabeza de hogar (3)
    expect(dentro("I17:J17")).toBe(true); // víctima del conflicto (4)
    expect(dentro("A34:C34")).toBe(true); // modalidad 1
    expect(dentro("D34:F34")).toBe(false);
    expect(marcas).toHaveLength(8);
  });

  it("writes each household member with the format's codes", () => {
    expect(en("B22:G22")).toEqual(["Luis Pérez"]);
    expect([...en("H22"), ...en("I22"), ...en("J22"), ...en("K22"), ...en("L22:M22")]).toEqual(["01", "06", "2015", "TI", "1100000001"]);
    expect([...en("N22"), ...en("O22"), ...en("P22"), ...en("Q22"), ...en("R22")]).toEqual(["", "2", "S", "ES", "M"].filter(Boolean));
    expect(en("S22:T22")).toEqual(["0"]);
    expect(en("B23:G23")).toEqual([]);
    expect(en("S32:T32")).toEqual(["1.300.000"]);
  });

  it("fills the project, the resources and the reception by the official", () => {
    expect(en("A42:K42")).toEqual(["Altos del Río"]);
    expect(en("A43:K43")).toEqual(["150.000.000"]);
    expect(en("L43:T43")).toEqual([]); // only the chosen VIS/VIP value
    expect([...en("D47:F47"), ...en("K47:T47")]).toEqual(["5.000.000", "Banco Uno"]);
    expect(en("D52:F52")).toEqual(["5.000.000"]);
    expect(en("G56:K56")).toEqual(["1144555666"]);
    expect(en("A58:H58")).toEqual(["Pedro Funcionario"]);
    expect(en("M59:N60")).toEqual(["7"]);
    expect([...en("O60:P60"), ...en("Q60:S60"), ...en("T60")]).toEqual(["2026", "11", "21"]);
    const firmas = ops.filter((x) => x.tipo === "firma").map((x) => [x.pagina, x.cual]);
    expect(firmas).toEqual([[1, "solicitante"], [1, "funcionario"]]);
  });

  it("leaves blank what does not apply (no obligation for modality 1, no empty values)", () => {
    expect(en("J37:L37")).toEqual([]);
    expect(en("C38:E38")).toEqual([]);
    expect(textos(ops).every((t) => t.trim() !== "")).toBe(true);
  });
});
