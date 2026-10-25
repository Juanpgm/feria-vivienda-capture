/** `FV` + 123 -> `FV-000123`. Numbers above 999999 simply grow (`FV-1000000`). */
export const formatearRadicado = (prefijo: string, n: number) => `${prefijo}-${String(n).padStart(6, "0")}`;

/**
 * Interprets a search text as a radicado: `FV-000123`, `fv000123`, or `123` is NOT accepted here (a bare number is a
 * document). Returns the canonical radicado or null.
 */
export function parsearRadicado(texto: string, prefijo: string): string | null {
  const m = new RegExp(String.raw`^${prefijo}\s*-?\s*(\d{1,9})$`, "i").exec(texto.trim());
  return m ? formatearRadicado(prefijo, Number(m[1])) : null;
}
