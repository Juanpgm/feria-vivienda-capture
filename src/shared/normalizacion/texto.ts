// Pure, idempotent text normalizers for name and document number.

/** "  ana MARÍA  pérez " -> "Ana María Pérez". Capitalizes after start/space/hyphen/apostrophe. */
export function normalizarNombre(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-CO")
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase("es-CO"));
}

/** Strips accents, uppercases and keeps only [A-Z0-9]. Always a string (leading zeros kept); "" = invalid. */
export function normalizarDocumento(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Parses an income typed as "1.500.000", "1500000 COP" or "$1,500,000" into integer pesos.
 * Returns null for anything else (decimals, text, negatives).
 */
export function parsearIngresoCop(raw: string): number | null {
  const s = raw.replace(/\bCOP\b|\$|\s/gi, "");
  if (!/^(\d+|\d{1,3}([.,]\d{3})+)$/.test(s)) return null;
  return Number(s.replace(/[.,]/g, ""));
}
