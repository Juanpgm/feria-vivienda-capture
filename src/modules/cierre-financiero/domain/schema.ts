import { z } from "zod";
import { FUENTES_FINANCIACION } from "@/shared/constantes";
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
  }));

export type CierreFinanciero = z.output<typeof cierreFinancieroSchema>;
