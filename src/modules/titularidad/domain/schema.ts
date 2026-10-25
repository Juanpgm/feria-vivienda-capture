import { z } from "zod";
import { TITULARIDADES } from "@/shared/constantes";
import { enumDe } from "@/shared/validacion";

export const titularidadSchema = z.object({
  tipo_titularidad: enumDe(TITULARIDADES),
  // Optional: empty never blocks; when given, trimmed alphanumeric/hyphen.
  numero_matricula_inmobiliaria: z
    .string()
    .nullish()
    .transform((s) => s?.trim() || null)
    .refine((s) => s === null || /^[A-Za-z0-9-]+$/.test(s), "Solo letras, números y guiones"),
});

export type Titularidad = z.output<typeof titularidadSchema>;
