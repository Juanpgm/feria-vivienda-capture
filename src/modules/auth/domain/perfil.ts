// "Mi cuenta": self-service profile data and role escalation requests.
import { z } from "zod";
import { normalizarDocumento, normalizarNombre } from "@/shared/normalizacion/texto";
import { telefonoOpcional, textoOpcional } from "@/shared/validacion";
import { MOTIVO_MAX, ROLES, type Rol } from "./roles";

export const perfilSchema = z.object({
  nombre: z
    .string({ error: "Ingrese su nombre completo" })
    .transform(normalizarNombre)
    .pipe(z.string().min(5, "Ingrese su nombre completo").max(120)),
  celular: telefonoOpcional,
  cedula: z
    .string()
    .nullish()
    .transform((s) => (s ? normalizarDocumento(s) : "") || null)
    .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, "Número de cédula inválido").nullable()),
  /** Shown as "Cargo" in the inspector's signature block of the visit format. */
  cargo: textoOpcional.pipe(z.string().max(80).nullable()),
});
export type Perfil = z.output<typeof perfilSchema>;

/** Only roles above the current one. */
export const rolesSolicitables = (actual: Rol): Rol[] => ROLES.slice(ROLES.indexOf(actual) + 1);

export const solicitudRolSchema = z.object({
  rol: z.enum(ROLES),
  motivo: z.string().trim().min(5, "Cuéntenos por qué necesita el cambio").max(MOTIVO_MAX),
});
