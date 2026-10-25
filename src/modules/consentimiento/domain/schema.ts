import { z } from "zod";
import { CONSENTIMIENTO_VERSION } from "./texto";

/** Stored in `composicion.condiciones_especiales` when the person refuses the treatment of sensitive data. */
export const CONDICION_NO_AUTORIZADO = "no_autorizado";

/**
 * Consent as sent by the form (and re-validated by the server). `version` is the wording the person saw when
 * ticking; the server also computes the hash of the current text itself, so nothing about the text is trusted.
 */
export const consentimientoSchema = z
  .object({
    acepta_tratamiento: z.boolean({ error: "Debe autorizar el tratamiento de datos personales para poder registrar la postulación" }),
    // Optional: declining never blocks the registration.
    acepta_datos_sensibles: z.boolean({ error: "Indique si autoriza el tratamiento de datos sensibles" }),
    version: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.acepta_tratamiento !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["acepta_tratamiento"],
        message: "Debe autorizar el tratamiento de datos personales para poder registrar la postulación",
      });
    } else if (v.version !== CONSENTIMIENTO_VERSION) {
      ctx.addIssue({ code: "custom", path: ["acepta_tratamiento"], message: "El texto de la autorización cambió. Léalo y acéptelo de nuevo." });
    }
  })
  .transform((v) => ({
    acepta_tratamiento: true as const,
    acepta_datos_sensibles: v.acepta_datos_sensibles,
    version: CONSENTIMIENTO_VERSION,
  }));

export type ConsentimientoEntrada = z.output<typeof consentimientoSchema>;

/** Special protection that may be stored: the selection only when sensitive data was authorized, else "no_autorizado". */
export function proteccionAutorizada(condiciones: readonly string[], aceptaSensibles: boolean): string[] {
  return aceptaSensibles ? [...condiciones] : [CONDICION_NO_AUTORIZADO];
}
