import { z } from "zod";
import { normalizarDireccion } from "@/shared/normalizacion/direccion";
import barrios from "../catalogo/barrios.json";
import divisiones from "../catalogo/divisiones.json";

// ponytail: catalogs are imported statically; lazy-load this schema (dynamic import) from the UI if the bundle matters.
const DIVISION = new Map(divisiones.map((d) => [d.codigo, d]));
const BARRIO = new Map(barrios.map((b) => [b.id, b]));

/** Whole number 1-6 from a number or a form string; null when missing or out of range. */
function aEstrato(v: unknown): number | null {
  const n = typeof v === "string" ? (v.trim() === "" ? Number.NaN : Number(v.trim())) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 6 ? n : null;
}

/** Affected dwelling location (form section 5). comuna/barrio cascade (catalog only, no free text) and sector are validated/derived here. */
export const inmuebleSchema = z
  .object({
    direccion: z.string({ error: "Ingrese la dirección" }).trim().min(5, "Ingrese la dirección"),
    codigo_division: z.string({ error: "Seleccione comuna o corregimiento" }),
    id_barrio_vereda: z.string().nullish(),
    // Checked in superRefine, not here: a type error on this field would skip the cross-field checks below
    // and the user would see the comuna / barrio errors only after fixing the estrato.
    estrato: z.unknown(),
  })
  .superRefine((v, ctx) => {
    const err = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (aEstrato(v.estrato) === null) err("estrato", "Seleccione un estrato del 1 al 6");
    if (!DIVISION.has(v.codigo_division)) return err("codigo_division", "Seleccione comuna o corregimiento");
    if (v.id_barrio_vereda) {
      const b = BARRIO.get(v.id_barrio_vereda);
      if (!b) err("id_barrio_vereda", "Seleccione un barrio o vereda de la lista");
      else if (b.codigo_division !== v.codigo_division) err("id_barrio_vereda", "El barrio no pertenece a la comuna o corregimiento");
    } else err("id_barrio_vereda", "Seleccione un barrio o vereda");
  })
  .transform((v) => {
    const div = DIVISION.get(v.codigo_division)!; // checked in superRefine
    const barrio = BARRIO.get(v.id_barrio_vereda!)!; // checked in superRefine
    const dir = normalizarDireccion(v.direccion);
    return {
      direccion: v.direccion,
      direccion_norm: dir.norm,
      es_direccion_norm_completa: dir.es_completa,
      tipo_division: div.tipo,
      codigo_division: div.codigo,
      nombre_division: div.nombre,
      id_barrio_vereda: barrio.id,
      nombre_barrio_vereda: barrio.nombre,
      sector: div.sector, // derived only, never client-provided
      estrato: aEstrato(v.estrato)!, // checked in superRefine
    };
  });

export type Inmueble = z.output<typeof inmuebleSchema>;
