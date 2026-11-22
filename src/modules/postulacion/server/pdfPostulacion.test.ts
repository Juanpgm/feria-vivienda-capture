import { writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { armarDatos } from "../domain/armar";
import { celda } from "../domain/formatoPdf";
import { ajustar, pdfPostulacion } from "./pdfPostulacion";

describe("ajustar", async () => {
  const fuente = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const ancho = (s: string, t: number) => fuente.widthOfTextAtSize(s, t);

  it("keeps a text that fits on one line at its size", () => {
    expect(ajustar("CC", fuente, 7, 40, 10)).toEqual({ lineas: ["CC"], tam: 7 });
  });

  it("wraps several condition codes of a member in their cell instead of cutting them", () => {
    const n = celda("N22");
    const r = ajustar("8,5,4,23", fuente, 5.5, n.w, n.h);
    expect(r.lineas.join("")).toBe("8,5,4,23");
    expect(r.lineas.length).toBe(2);
    expect(r.tam).toBeGreaterThanOrEqual(4);
    expect(r.lineas.length * r.tam * 1.1).toBeLessThanOrEqual(n.h);
    for (const l of r.lineas) expect(ancho(l, r.tam)).toBeLessThanOrEqual(n.w);
  });

  it("cuts with an ellipsis only what cannot fit even wrapped, and never overflows", () => {
    const r = ajustar("Supercalifragilisticoespialidoso", fuente, 7, 20, 6);
    expect(r.lineas).toHaveLength(1);
    expect(r.lineas[0].endsWith("…")).toBe(true);
    expect(ancho(r.lineas[0], r.tam)).toBeLessThanOrEqual(20);
  });
});

// A 1x1 PNG: enough to prove signatures are embedded.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));

describe("pdfPostulacion", () => {
  it("returns the 4 pages of the format with the values drawn, even with characters outside WinAnsi", async () => {
    const r = armarDatos({
      solicitante: {
        nombres: "ana ŝofía", apellidos: "pérez", tipo_documento: "cc", numero_documento: "1144555666", fecha_nacimiento: "1985-03-15", telefono: "3001234567",
        condiciones_especiales: ["ninguna"], lugar_expedicion: "76001", fecha_expedicion: "2003-04-01", lugar_nacimiento: "76001", ingreso_mensual: "1300000",
        genero: "otro", genero_otro: "no binario", ocupacion: "empleado", empresa: "Empresa de nombre muy largo que no cabe en la celda S.A.S.", telefono_empresa: "6023334455",
        direccion: "calle 12 # 5-20", codigo_division: "19", id_barrio_vereda: "1912", estrato: "4", anios_residencia: "20", correo: "ana@correo.com",
        notificacion_electronica: "si", caja_compensacion: "si", caja_cual: "Comfandi", sisben: "no",
      },
      hogar: { integrantes: [] },
      postulacion: {
        modalidad: "10", entidad_acreedora: "fev", numero_obligacion: "123", programa_obligacion: "Potrero Grande", saldo_adeudado: "2500000",
        estado_obligacion: "en_mora", autoriza_giro: true, fuentes: [], recursos: {},
      },
    });
    if (!r.ok) throw new Error(JSON.stringify(r.errores));
    const validacion = { codigo_validacion: "VAL-000001-ABCDEF", funcionario_nombre: "Pedro Funcionario", validado_en: "2026-11-21T10:30:00.000-05:00", folios_anexos: 3 };
    const pdf = await pdfPostulacion({ ...r.datos, radicado: "PSE-000001", validacion }, { solicitante: { mime: "image/png", datos: PNG }, funcionario: { mime: "image/webp", datos: PNG } });
    if (process.env.PDF_SALIDA) await writeFile(process.env.PDF_SALIDA, pdf);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(4);
    expect(doc.getTitle()).toBe("Postulación PSE-000001");
  });
});
