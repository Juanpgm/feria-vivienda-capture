import { z } from "zod";
import { ESTADOS_SGOV } from "@/shared/constantes";
import { normalizarDireccion } from "@/shared/normalizacion/direccion";
import { enumDe, entero, textoOpcional } from "@/shared/validacion";
import barrios from "../catalogo/barrios.json";
import divisiones from "../catalogo/divisiones.json";

// ponytail: catalogs are imported statically; lazy-load this schema (dynamic import) from the UI if the bundle matters.
const DIVISION = new Map(divisiones.map((d) => [d.codigo, d]));
const BARRIO = new Map(barrios.map((b) => [b.id, b]));

/** Affected dwelling location (form section 5). comuna/barrio cascade and sector are validated/derived here. */
export const inmuebleSchema = z
  .object({
    direccion: z.string({ error: "Ingrese la dirección" }).trim().min(5, "Ingrese la dirección"),
    codigo_division: z.string({ error: "Seleccione comuna o corregimiento" }),
    id_barrio_vereda: z.string().nullish(),
    barrio_vereda_otro: textoOpcional, // "not listed" fallback
    estrato: entero("Seleccione un estrato del 1 al 6").pipe(z.number().min(1, "Estrato del 1 al 6").max(6, "Estrato del 1 al 6")),
    es_unica_propiedad: z.boolean().nullish(),
    excepcion_unica_propiedad: textoOpcional,
    estado_sgov: enumDe(ESTADOS_SGOV).nullish(),
  })
  .superRefine((v, ctx) => {
    const err = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!DIVISION.has(v.codigo_division)) return err("codigo_division", "Seleccione comuna o corregimiento");
    if (v.id_barrio_vereda) {
      const b = BARRIO.get(v.id_barrio_vereda);
      if (!b) err("id_barrio_vereda", "Seleccione un barrio o vereda de la lista");
      else if (b.codigo_division !== v.codigo_division) err("id_barrio_vereda", "El barrio no pertenece a la comuna o corregimiento");
    } else if (!v.barrio_vereda_otro) err("id_barrio_vereda", "Seleccione un barrio o vereda");
  })
  .transform((v) => {
    const div = DIVISION.get(v.codigo_division)!; // checked in superRefine
    const barrio = v.id_barrio_vereda ? BARRIO.get(v.id_barrio_vereda) : undefined;
    const dir = normalizarDireccion(v.direccion);
    return {
      direccion: v.direccion,
      direccion_norm: dir.norm,
      es_direccion_norm_completa: dir.es_completa,
      tipo_division: div.tipo,
      codigo_division: div.codigo,
      nombre_division: div.nombre,
      id_barrio_vereda: barrio?.id ?? null,
      nombre_barrio_vereda: barrio?.nombre ?? null,
      barrio_vereda_otro: barrio ? null : v.barrio_vereda_otro,
      sector: div.sector, // derived only, never client-provided
      estrato: v.estrato,
      es_unica_propiedad: v.es_unica_propiedad ?? null,
      excepcion_unica_propiedad: v.excepcion_unica_propiedad,
      estado_sgov: v.estado_sgov ?? null,
    };
  });

export type Inmueble = z.output<typeof inmuebleSchema>;
