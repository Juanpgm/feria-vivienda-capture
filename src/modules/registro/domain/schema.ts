import { z } from "zod";
import { cierreFinancieroSchema } from "@/modules/cierre-financiero/domain/schema";
import { composicionSchema } from "@/modules/composicion/domain/schema";
import { consentimientoSchema, proteccionAutorizada } from "@/modules/consentimiento/domain/schema";
import { firmaSchema } from "@/modules/firma/domain/schema";
import { hogarSchema } from "@/modules/hogar/domain/schema";
import { inmuebleSchema } from "@/modules/inmueble/domain/schema";
import { riesgoSchema } from "@/modules/riesgo/domain/schema";
import { titularidadSchema } from "@/modules/titularidad/domain/schema";

/**
 * Whole registration, shared by the client form and the server (which re-parses the raw payload).
 * The two document photos and the drawn signature image are NOT part of it: they go to the adjuntos endpoint.
 */
export const registroSchema = z.object({
  // Client-generated at draft start; the idempotency key of the create.
  id: z.uuid({ error: "Identificador de registro inválido" }),
  solicitante: hogarSchema,
  composicion: composicionSchema,
  inmueble: inmuebleSchema,
  riesgo: riesgoSchema,
  titularidad: titularidadSchema,
  cierre_financiero: cierreFinancieroSchema,
  // Required: a registration without authorization or without signature (drawn or manual) is rejected (422).
  consentimiento: consentimientoSchema,
  firma: firmaSchema,
}).transform(({ cierre_financiero: { observaciones, ...cierre }, composicion, consentimiento, ...resto }) => ({
  ...resto,
  // Sensitive data is stored only with the person's explicit authorization (REQ-CON-3).
  composicion: { ...composicion, condiciones_especiales: proteccionAutorizada(composicion.condiciones_especiales, consentimiento.acepta_datos_sensibles) },
  consentimiento,
  cierre_financiero: cierre,
  // Stored at the top level of the record (the form edits it in the last data step).
  observaciones,
}));

export type RegistroEntrada = z.input<typeof registroSchema>;
export type RegistroDatos = z.output<typeof registroSchema>;
