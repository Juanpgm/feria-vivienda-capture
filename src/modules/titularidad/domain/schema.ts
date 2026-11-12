import { z } from "zod";
import { EXCEPCIONES_UNICA_PROPIEDAD, TITULARIDADES } from "@/shared/constantes";
import { enumDe, textoOpcional } from "@/shared/validacion";

/** Asked only to owners: a tenant is recorded as "No" (not their only property) without being asked, whatever was sent. */
const sinPreguntarAlArrendatario = (raw: unknown) =>
  raw && typeof raw === "object" && (raw as { tipo_titularidad?: unknown }).tipo_titularidad === "arrendatario" ? { ...raw, es_unica_propiedad: false } : raw;

export const titularidadSchema = z.preprocess(
  sinPreguntarAlArrendatario,
  z
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
    if (v.tipo_titularidad === "arrendatario") return; // no exception to give: the question does not apply
    if (v.es_unica_propiedad === false && !v.excepcion_unica_propiedad)
      ctx.addIssue({ code: "custom", path: ["excepcion_unica_propiedad"], message: "Seleccione la excepción que aplica" });
    else if (v.es_unica_propiedad === false && v.excepcion_unica_propiedad === "otra" && !v.excepcion_otra)
      ctx.addIssue({ code: "custom", path: ["excepcion_otra"], message: "Describa la excepción" });
  })
  .transform((v) => {
    const aplica = v.tipo_titularidad !== "arrendatario" && !v.es_unica_propiedad; // only an owner with other properties gives an exception
    return {
      ...v,
      excepcion_unica_propiedad: aplica ? (v.excepcion_unica_propiedad ?? null) : null,
      excepcion_otra: aplica && v.excepcion_unica_propiedad === "otra" ? v.excepcion_otra : null,
    };
  }),
);

export type Titularidad = z.output<typeof titularidadSchema>;
