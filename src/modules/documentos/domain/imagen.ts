// Pure image rules shared by the browser (capture) and the server (upload validation). No DOM, no Node APIs.

export const TIPOS_ADJUNTO = ["documento_frente", "documento_reverso", "firma"] as const;
export type TipoAdjunto = (typeof TIPOS_ADJUNTO)[number];
export const TIPOS_FOTO = ["documento_frente", "documento_reverso"] as const satisfies readonly TipoAdjunto[];
export type TipoFoto = (typeof TIPOS_FOTO)[number];

export const ETIQUETA_ADJUNTO: Record<TipoAdjunto, string> = {
  documento_frente: "Frente del documento",
  documento_reverso: "Reverso del documento",
  firma: "Firma",
};

/** Client target: the compressed photo must not exceed this. */
export const MAX_FOTO_BYTES = 700 * 1024;
/** Client downscale target for the long side. */
export const MAX_LADO_PX = 1600;
/**
 * Server caps. A Firestore document holds 1 MiB in total and the image is stored as raw bytes (not base64), so
 * 900 KB leaves room for the metadata fields. Above this, move to Firebase Storage.
 */
export const MAX_BYTES_SERVIDOR: Record<TipoAdjunto, number> = {
  documento_frente: 900 * 1024,
  documento_reverso: 900 * 1024,
  firma: 100 * 1024,
};

export type MimeImagen = "image/jpeg" | "image/png" | "image/webp";
export type FormatoImagen = MimeImagen | "image/gif" | "image/heic";

const empieza = (b: Uint8Array, firma: number[], desde = 0) => firma.every((v, i) => b[desde + i] === v);
const ascii = (b: Uint8Array, desde: number, texto: string) => [...texto].every((c, i) => b[desde + i] === c.charCodeAt(0));

/** Identifies an image by its leading bytes (never by file name or declared type); null when unknown. */
export function detectarFormato(b: Uint8Array): FormatoImagen | null {
  if (b.length < 12) return null;
  if (empieza(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  if (ascii(b, 0, "GIF8")) return "image/gif";
  if (ascii(b, 4, "ftyp") && ["heic", "heix", "mif1", "heif"].some((m) => ascii(b, 8, m))) return "image/heic";
  return null;
}

/** Formats the server stores. */
export const MIMES_ADMITIDOS: readonly MimeImagen[] = ["image/jpeg", "image/png", "image/webp"];
export const esMimeAdmitido = (f: string | null): f is MimeImagen => MIMES_ADMITIDOS.includes(f as MimeImagen);

/** Size to draw so the long side is at most `maxLado` (never upscales); sides are at least 1 px. */
export function dimensionesFinales(ancho: number, alto: number, maxLado = MAX_LADO_PX, escala = 1) {
  const f = Math.min(1, maxLado / Math.max(ancho, alto)) * escala;
  return { ancho: Math.max(1, Math.round(ancho * f)), alto: Math.max(1, Math.round(alto * f)) };
}

/** Ordered (scale, quality) attempts: first full size with decreasing quality, then smaller sizes. */
export function planDeCompresion(): { escala: number; calidad: number }[] {
  const plan: { escala: number; calidad: number }[] = [];
  for (const escala of [1, 0.8, 0.65, 0.5]) for (const calidad of [0.85, 0.75, 0.65, 0.55, 0.45]) plan.push({ escala, calidad });
  return plan;
}

/** Runs the plan until `codificar` yields a blob within `limite`; null when no attempt fits. */
export async function comprimirHasta<T extends { size: number }>(
  codificar: (escala: number, calidad: number) => Promise<T | null>,
  limite = MAX_FOTO_BYTES,
): Promise<T | null> {
  for (const { escala, calidad } of planDeCompresion()) {
    const r = await codificar(escala, calidad);
    if (r && r.size <= limite) return r;
  }
  return null;
}

export const formatoTamano = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/** Spanish message for a rejected input file given its detected format; null when it can be processed. */
export function errorDeFormato(f: FormatoImagen | null): string | null {
  if (f === "image/heic") return "Este formato de imagen (HEIC) no es compatible. Tome la foto de nuevo o elija una imagen JPEG o PNG.";
  if (!f) return "El archivo no es una imagen. Elija una foto en formato JPEG, PNG o WebP.";
  return null;
}
