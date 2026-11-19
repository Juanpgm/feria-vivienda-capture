// Pure check of an uploaded signature image (RGBA pixels): it must look like ink strokes on a light background — not
// blank, not a dark or busy photo. ponytail: a luminance heuristic, not signature recognition; an official still
// looks at the image when validating.

/** Share of "ink" pixels (luma < 140) allowed: below = blank, above = not a signature (photo, dark background). */
export const TINTA_MIN = 0.003;
export const TINTA_MAX = 0.3;
/** Average luma of the background must be light. */
export const FONDO_MIN = 170;

export function evaluarTinta(rgba: ArrayLike<number>): { ok: true } | { ok: false; mensaje: string } {
  let tinta = 0;
  let suma = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const luma = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    suma += luma;
    if (luma < 140) tinta++;
  }
  const proporcion = tinta / n;
  if (proporcion < TINTA_MIN) return { ok: false, mensaje: "No se ve ninguna firma en la imagen. Use una foto donde la firma se vea oscura y nítida." };
  if (proporcion > TINTA_MAX || suma / n < FONDO_MIN)
    return { ok: false, mensaje: "La imagen no parece una firma: debe ser tinta oscura sobre fondo blanco, recortada para que solo se vea la firma." };
  return { ok: true };
}
