// Draws a postulación on the official format: the template PDF (Excel's own export of the .xlsx, so it prints exactly
// like the format) plus the values at the positions of domain/formatoPdf.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from "pdf-lib";
import { operacionesFormato, type EntradaFormato } from "../domain/formatoPdf";

const PLANTILLA = path.join(process.cwd(), "src/modules/postulacion/plantilla/formato-postulacion-v10.pdf");
const TINTA = rgb(0.05, 0.1, 0.35);
const TAM_MINIMO = 4;
const INTERLINEA = 1.1;

export type Firma = { mime: string; datos: Uint8Array } | null;

const caracteres = new WeakMap<PDFFont, Set<number>>();
/** Standard PDF fonts only encode WinAnsi: drop accents of anything else instead of failing on it. */
function legible(texto: string, fuente: PDFFont) {
  let soportados = caracteres.get(fuente);
  if (!soportados) caracteres.set(fuente, (soportados = new Set(fuente.getCharacterSet())));
  return [...texto.normalize("NFC")].map((ch) => (soportados.has(ch.codePointAt(0)!) ? ch : ch.normalize("NFD").replace(/[^\x20-\x7e]/g, ""))).join("");
}

/** Greedy wrap at spaces and commas (separators stay at the end of their line). */
function partir(texto: string, fuente: PDFFont, tam: number, ancho: number) {
  const lineas: string[] = [];
  let actual = "";
  for (const pieza of texto.match(/[^\s,]+[\s,]*/g) ?? []) {
    if (actual && fuente.widthOfTextAtSize((actual + pieza).trimEnd(), tam) > ancho) {
      lineas.push(actual.trimEnd());
      actual = pieza;
    } else actual += pieza;
  }
  if (actual) lineas.push(actual.trimEnd());
  return lineas;
}

/**
 * Lines and font size that fit `texto` in a `ancho` x `alto` box: shrink first, wrap when the box has room for more
 * than one line, and cut with an ellipsis only as a last resort.
 */
export function ajustar(texto: string, fuente: PDFFont, tam: number, ancho: number, alto: number) {
  const cabe = (s: string, t: number) => fuente.widthOfTextAtSize(s, t) <= ancho;
  for (let t = tam; t >= TAM_MINIMO; t -= 0.25) {
    if (cabe(texto, t)) return { lineas: [texto], tam: t };
    const caben = Math.floor(alto / (t * INTERLINEA));
    if (caben < 2) continue;
    const lineas = partir(texto, fuente, t, ancho);
    if (lineas.length <= caben && lineas.every((l) => cabe(l, t))) return { lineas, tam: t };
  }
  let corto = texto;
  while (corto && !cabe(`${corto}…`, TAM_MINIMO)) corto = corto.slice(0, -1);
  return { lineas: [`${corto}…`], tam: TAM_MINIMO };
}

/** PNG/JPEG only (the signature pad exports nothing else); an unreadable image leaves the box blank to sign by hand. */
async function imagen(doc: PDFDocument, f: Firma): Promise<PDFImage | null> {
  try {
    if (f?.mime === "image/png") return await doc.embedPng(f.datos);
    if (f?.mime === "image/jpeg") return await doc.embedJpg(f.datos);
  } catch (e) {
    console.warn("[pdfPostulacion] firma ilegible", f?.mime, f?.datos.length, e);
  }
  if (f) console.warn("[pdfPostulacion] firma no impresa", f.mime);
  return null;
}

export async function pdfPostulacion(p: EntradaFormato, firmas: { solicitante: Firma; funcionario: Firma }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await readFile(PLANTILLA));
  doc.setTitle(`Postulación ${p.radicado}`);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const paginas = doc.getPages();
  const imagenes = { solicitante: await imagen(doc, firmas.solicitante), funcionario: await imagen(doc, firmas.funcionario) };

  for (const op of operacionesFormato(p)) {
    const pagina = paginas[op.pagina];
    const alto = pagina.getHeight();
    if (op.tipo === "marca") {
      pagina.drawText("X", { x: op.x - negrita.widthOfTextAtSize("X", 7) / 2, y: alto - op.y - 2.5, size: 7, font: negrita, color: TINTA });
    } else if (op.tipo === "texto") {
      const fuente = op.negrita ? negrita : normal;
      const { lineas, tam } = ajustar(legible(op.texto, fuente), fuente, op.tam, op.w, op.h);
      const lh = tam * INTERLINEA;
      // The block of lines centered in the box; each baseline centers its cap height (Helvetica ≈ 0.72 em) in its line.
      const arriba = alto - op.y - (op.h - lineas.length * lh) / 2;
      lineas.forEach((texto, i) => {
        const ancho = fuente.widthOfTextAtSize(texto, tam);
        const x = op.alinear === "centro" ? op.x + (op.w - ancho) / 2 : op.x;
        const y = arriba - i * lh - lh / 2 - (tam * 0.72) / 2;
        pagina.drawText(texto, { x, y, size: tam, font: fuente, color: TINTA });
      });
    } else {
      const img = imagenes[op.cual];
      if (!img) continue;
      const k = Math.min(op.w / img.width, op.h / img.height);
      const w = img.width * k;
      const h = img.height * k;
      pagina.drawImage(img, { x: op.x + (op.w - w) / 2, y: alto - op.y - op.h + (op.h - h) / 2, width: w, height: h });
    }
  }
  return doc.save();
}
