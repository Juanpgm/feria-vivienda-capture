// DD/MM/AAAA mask <-> ISO 8601 (YYYY-MM-DD). The form, the draft and the schemas only ever hold ISO.
import { esFechaIso } from "./validacion";

/** Digits typed or pasted -> "DD/MM/AAAA" progressively ("1503" -> "15/03"). Slashes appear when a digit follows. */
export function aMascara(entrada: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entrada.trim());
  const d = (iso ? iso[3] + iso[2] + iso[1] : entrada.replace(/\D/g, "")).slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
}

export type FechaParseada = { iso: string } | { error: "incompleta" | "inexistente"; mensaje: string };

/** Complete, real calendar date in the mask -> ISO; otherwise a Spanish message that says what is wrong. */
export function parseMascara(texto: string): FechaParseada {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return { error: "incompleta", mensaje: "Escriba la fecha completa: día, mes y año (DD/MM/AAAA)" };
  const [, dd, mm, aaaa] = m;
  const iso = `${aaaa}-${mm}-${dd}`;
  if (esFechaIso(iso) && +aaaa >= 1900) return { iso };
  if (+mm < 1 || +mm > 12) return { error: "inexistente", mensaje: "El mes debe estar entre 01 y 12" };
  if (+dd < 1 || +dd > 31) return { error: "inexistente", mensaje: "El día debe estar entre 01 y 31" };
  if (+aaaa < 1900) return { error: "inexistente", mensaje: "El año debe ser 1900 o posterior" };
  return { error: "inexistente", mensaje: `Esa fecha no existe: el mes ${mm} de ${aaaa} no tiene el día ${dd}` };
}

/** ISO -> mask; anything else (a half-typed date kept in the form) is returned unchanged. */
export const isoAMascara = (valor: string): string =>
  esFechaIso(valor) ? valor.split("-").reverse().join("/") : valor;
