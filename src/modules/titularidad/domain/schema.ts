import { z } from "zod";
import { EXCEPCIONES_UNICA_PROPIEDAD, TITULARIDADES } from "@/shared/constantes";
import { enumDe, textoOpcional } from "@/shared/validacion";

export const titularidadSchema = z
  .object({
    tipo_titularidad: enumDe(TITULARIDADES),
    // Optional: empty never blocks; when given, trimmed alphanumeric/hyphen.
    numero_matricula_inmobiliaria: z
      .string()
      .nullish()
      .transform((s) => s?.trim() || null)
      .refine((s) => s === null || /^[A-Za-z0-9-]+$/.test(s), "Solo letras, números y guiones"),
    es_unica_propiedad: z.boolean({ error: "Seleccione Sí o No" }),
    // Legal exception, required only when it is NOT the only residential property.
    excepcion_unica_propiedad: z.preprocess((v) => (v === "" ? undefined : v), enumDe(EXCEPCIONES_UNICA_PROPIEDAD).nullish()),
    // Free text, required only when the exception is "otra".
    excepcion_otra: textoOpcional,
  })
  .superRefine((v, ctx) => {
    if (v.es_unica_propiedad === false && !v.excepcion_unica_propiedad)
      ctx.addIssue({ code: "custom", path: ["excepcion_unica_propiedad"], message: "Seleccione la excepción que aplica" });
    else if (v.es_unica_propiedad === false && v.excepcion_unica_propiedad === "otra" && !v.excepcion_otra)
      ctx.addIssue({ code: "custom", path: ["excepcion_otra"], message: "Describa la excepción" });
  })
  .transform((v) => ({
    ...v,
    excepcion_unica_propiedad: v.es_unica_propiedad ? null : (v.excepcion_unica_propiedad ?? null),
    excepcion_otra: !v.es_unica_propiedad && v.excepcion_unica_propiedad === "otra" ? v.excepcion_otra : null,
  }));

export type Titularidad = z.output<typeof titularidadSchema>;
