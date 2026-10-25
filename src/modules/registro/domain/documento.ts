import { normalizarDocumento } from "@/shared/normalizacion/texto";

/** Digits shorter than this never produce a "similar" match (too many false positives). */
export const MIN_DIGITOS_SIMILAR = 5;

/**
 * Indexed keys of a document number, written at creation and used for duplicate detection.
 * - `documento_clave`: normalized number (A-Z0-9, accents stripped); the tipo_documento is deliberately NOT part of it.
 * - `documento_digitos`: only its digits without leading zeros (null when too short), to catch prefix/letter differences
 *   such as `CC1234567` vs `1234567`.
 */
export function clavesDocumento(numero: string): { documento_clave: string; documento_digitos: string | null } {
  const documento_clave = normalizarDocumento(numero);
  const digitos = documento_clave.replace(/\D/g, "").replace(/^0+/, "");
  return { documento_clave, documento_digitos: digitos.length >= MIN_DIGITOS_SIMILAR ? digitos : null };
}

export type Coincidencia = "exacta" | "similar";

/** Match rule between a stored record and the searched number (exact wins over similar). */
export function coincidencia(
  buscado: { documento_clave: string; documento_digitos: string | null },
  guardado: { documento_clave?: unknown; documento_digitos?: unknown },
): Coincidencia | null {
  if (buscado.documento_clave && guardado.documento_clave === buscado.documento_clave) return "exacta";
  if (buscado.documento_digitos && guardado.documento_digitos === buscado.documento_digitos) return "similar";
  return null;
}
