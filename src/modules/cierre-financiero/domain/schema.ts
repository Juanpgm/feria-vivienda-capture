import { z } from "zod";
import { FUENTES_FINANCIACION, MAX_OBSERVACIONES } from "@/shared/constantes";
import { listaExclusiva, textoOpcional } from "@/shared/validacion";
import aseguradoras from "../catalogo/aseguradoras.json";

const ASEGURADORA = new Map(aseguradoras.items.map((a) => [a.codigo, a.nombre]));

/** Financial closing: funding sources and insurance (insurer from the catalog; "otra" needs text). */
export const cierreFinancieroSchema = z
  .object({
    fuentes_financiacion: listaExclusiva(FUENTES_FINANCIACION),
    tiene_seguro: z.boolean({ error: "Seleccione Sí o No" }),
    codigo_aseguradora: z.string().nullish(),
    aseguradora_otra: textoOpcional,
    // Free text from the officer; hoisted to the top-level `observaciones` of the record by registroSchema.
    observaciones: textoOpcional.refine((s) => s === null || s.length <= MAX_OBSERVACIONES, `Máximo ${MAX_OBSERVACIONES} caracteres`),
  })
  .superRefine((v, ctx) => {
    if (!v.tiene_seguro) return;
    if (!v.codigo_aseguradora || !ASEGURADORA.has(v.codigo_aseguradora))
      ctx.addIssue({ code: "custom", path: ["codigo_aseguradora"], message: "Seleccione la aseguradora" });
    else if (v.codigo_aseguradora === "otra" && !v.aseguradora_otra)
      ctx.addIssue({ code: "custom", path: ["aseguradora_otra"], message: "Indique el nombre de la aseguradora" });
  })
  .transform((v) => ({
    fuentes_financiacion: v.fuentes_financiacion,
    tiene_seguro: v.tiene_seguro,
    codigo_aseguradora: v.tiene_seguro ? (v.codigo_aseguradora ?? null) : null,
    aseguradora_otra: v.tiene_seguro && v.codigo_aseguradora === "otra" ? v.aseguradora_otra : null,
    observaciones: v.observaciones,
  }));

export type CierreFinanciero = z.output<typeof cierreFinancieroSchema>;
