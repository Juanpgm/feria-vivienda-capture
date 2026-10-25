// Small zod building blocks shared by every domain schema (client and server).
import { z } from "zod";
import { normalizarTelefono } from "./normalizacion/telefono";

/** z.enum over the KEYS of a constants map (codes), not its labels. */
export const enumDe = <T extends string>(o: Record<T, string>) =>
  z.enum(Object.keys(o) as [T, ...T[]], { error: "Seleccione una opción" });

/** Real calendar date as ISO 8601 `YYYY-MM-DD` (rejects 2026-02-30). */
export function esFechaIso(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === s;
}
export const fechaIso = z.string({ error: "Ingrese una fecha" }).refine(esFechaIso, "Fecha inválida");

/** Number from a form: accepts 2.5, "2.5" and "2,5"; empty/non-numeric becomes NaN and fails with `msg`. */
const aNumero = (v: unknown) =>
  typeof v === "string" ? (v.trim() === "" ? Number.NaN : Number(v.trim().replace(",", "."))) : v;
export const numero = (msg: string) => z.preprocess(aNumero, z.number({ error: msg }));

export const entero = (msg = "Debe ser un número entero") =>
  z.preprocess(aNumero, z.number({ error: msg }).int(msg));

/** Multi-select where `ninguna` excludes everything else; at least one choice is required. */
export const listaExclusiva = <T extends string>(o: Record<T, string>) =>
  z
    .array(enumDe(o), { error: "Seleccione al menos una opción" })
    .min(1, "Seleccione al menos una opción")
    .refine((l) => !(l as string[]).includes("ninguna") || new Set(l).size === 1, "«Ninguna» no se puede combinar con otras opciones")
    .transform((l) => [...new Set(l)]);

function aTelefono(s: string, ctx: z.RefinementCtx): string {
  const t = normalizarTelefono(s);
  if (!t) {
    ctx.addIssue({ code: "custom", message: "Teléfono inválido" });
    return z.NEVER;
  }
  return t;
}
export const telefono = z.string({ error: "Ingrese un teléfono" }).transform(aTelefono);
/** Empty/absent becomes null. */
export const telefonoOpcional = z
  .string()
  .nullish()
  .transform((s, ctx) => (s?.trim() ? aTelefono(s, ctx) : null));

/** Trimmed text where empty/absent becomes null. */
export const textoOpcional = z
  .string()
  .nullish()
  .transform((s) => s?.trim() || null);
