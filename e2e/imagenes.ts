// Test images generated in the browser (canvas) so no binary fixtures are committed. Buffers are handed to
// `setInputFiles`. EXIF is injected by hand (a tiny APP1 segment) to exercise orientation handling.
import type { Page } from "@playwright/test";

type Archivo = { name: string; mimeType: string; buffer: Buffer };

/** Draws `dibujar` on a canvas of ancho x alto inside the page and returns the encoded bytes. */
async function codificar(page: Page, ancho: number, alto: number, mime: string, calidad: number, dibujar: string): Promise<Buffer> {
  // A blank page: no app CSP to get in the way of the generator and no interference with the page under test.
  const aux = await page.context().newPage();
  const b64 = await aux.evaluate(
    async ([w, h, m, q, codigo]) => {
      const c = document.createElement("canvas");
      c.width = w as number;
      c.height = h as number;
      const ctx = c.getContext("2d")!;
      new Function("ctx", "w", "h", codigo as string)(ctx, w, h);
      const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), m as string, q as number));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
    [ancho, alto, mime, calidad, dibujar] as const,
  );
  await aux.close();
  return Buffer.from(b64, "base64");
}

/** Busy scene (random rectangles + lines) so JPEG cannot shrink it trivially. */
const ESCENA = `
  ctx.fillStyle = "#c8d4e0"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = "hsl(" + Math.floor(Math.random() * 360) + " 70% " + (30 + Math.floor(Math.random() * 50)) + "%)";
    ctx.fillRect(Math.random() * w, Math.random() * h, 5 + Math.random() * 90, 5 + Math.random() * 90);
  }
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) { const n = Math.random() * 70; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  ctx.putImageData(d, 0, 0);
  ctx.fillStyle = "#222"; ctx.font = "bold " + Math.round(h / 8) + "px sans-serif"; ctx.fillText("DOCUMENTO", w / 8, h / 2);
`;

/** Large noisy JPEG, several MB: must be downscaled and recompressed. */
export const imagenGrande = async (page: Page, nombre = "documento-grande.jpg"): Promise<Archivo> => ({
  name: nombre,
  mimeType: "image/jpeg",
  buffer: await codificar(page, 3600, 2700, "image/jpeg", 0.98, ESCENA),
});

/** Small valid JPEG (well under the limit). */
export const imagenPequena = async (page: Page, nombre = "pequena.jpg", color = "#3a7bd5"): Promise<Archivo> => ({
  name: nombre,
  mimeType: "image/jpeg",
  buffer: await codificar(page, 640, 400, "image/jpeg", 0.9, `ctx.fillStyle = "${color}"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#fff"; ctx.fillRect(40, 40, w - 80, h - 80);`),
});

/** Valid PNG (decoded and re-encoded as JPEG by the app). */
export const imagenPng = async (page: Page): Promise<Archivo> => ({
  name: "documento.png",
  mimeType: "image/png",
  buffer: await codificar(page, 800, 500, "image/png", 1, `ctx.fillStyle = "#488148"; ctx.fillRect(0, 0, w, h);`),
});

export const archivoTexto = (): Archivo => ({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("esto no es una imagen") });
/** Text pretending to be a JPEG: the app must look at the bytes, not at the name or declared type. */
export const textoComoJpeg = (): Archivo => ({ name: "falsa.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<html>no soy un jpeg de verdad, solo un texto largo</html>") });

/** Inserts an EXIF APP1 segment with Orientation = `orientacion` right after the SOI marker of a JPEG. */
export function conOrientacionExif(jpeg: Buffer, orientacion: number): Buffer {
  const tiff = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // II, 42, offset of IFD0
    0x01, 0x00, // one entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientacion, 0x00, 0x00, 0x00, // tag 0x0112 SHORT x1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);
  const cuerpo = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const cabecera = Buffer.from([0xff, 0xe1, (cuerpo.length + 2) >> 8, (cuerpo.length + 2) & 0xff]);
  return Buffer.concat([jpeg.subarray(0, 2), cabecera, cuerpo, jpeg.subarray(2)]);
}

/** 800x400 JPEG, left half red and right half blue, flagged as "rotate 90 CW": displays as 400x800 (portrait). */
export const imagenConExif = async (page: Page): Promise<Archivo> => ({
  name: "girada.jpg",
  mimeType: "image/jpeg",
  buffer: conOrientacionExif(
    await codificar(page, 800, 400, "image/jpeg", 0.9, `ctx.fillStyle = "#d00"; ctx.fillRect(0, 0, w / 2, h); ctx.fillStyle = "#00d"; ctx.fillRect(w / 2, 0, w / 2, h);`),
    6,
  ),
});
