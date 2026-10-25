import { z } from "zod";
import { ESTADOS_CIVILES, TIPOS_DOCUMENTO } from "@/shared/constantes";
import { normalizarDocumento, normalizarNombre } from "@/shared/normalizacion/texto";
import { fechaBogota } from "@/shared/tiempo";
import { enumDe, fechaIso, numero, telefono, telefonoOpcional, textoOpcional } from "@/shared/validacion";
import nacionalidades from "../catalogo/nacionalidades.json";

export const CODIGO_COLOMBIA = "CO";
const NACIONALIDAD = new Map(nacionalidades.map((n) => [n.codigo, n.nombre]));

/** Applicant data (form section 1.1). */
export const hogarSchema = z
  .object({
    nombre_completo: z
      .string({ error: "Ingrese el nombre completo" })
      .trim()
      .min(2, "Ingrese el nombre completo")
      .transform(normalizarNombre),
    tipo_documento: enumDe(TIPOS_DOCUMENTO),
    tipo_documento_otro: textoOpcional,
    codigo_pais_nacionalidad: z
      .string({ error: "Seleccione una nacionalidad" })
      .refine((c) => NACIONALIDAD.has(c), "Seleccione una nacionalidad"),
    numero_documento: z
      .string({ error: "Ingrese el número de documento" })
      .transform(normalizarDocumento)
      .refine((d) => d.length > 0, "Ingrese un número de documento válido"),
    fecha_expedicion_documento: fechaIso,
    telefono_1: telefono,
    telefono_2: telefonoOpcional,
    correo_solicitante: z
      .string({ error: "Ingrese el correo" })
      .trim()
      .toLowerCase()
      .pipe(z.email("Correo inválido")),
    anios_residencia: numero("Ingrese los años de residencia").pipe(
      z.number().min(0, "No puede ser negativo").max(120, "Valor demasiado alto"),
    ),
    fecha_nacimiento: fechaIso,
    estado_civil: enumDe(ESTADOS_CIVILES),
  })
  .superRefine((v, ctx) => {
    const err = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const hoy = fechaBogota();
    if (v.tipo_documento === "otro" && !v.tipo_documento_otro) err("tipo_documento_otro", "Indique el tipo de documento");
    // CC => always Colombiana; CE / Otro => any nationality of the catalog.
    if (v.tipo_documento === "cc" && v.codigo_pais_nacionalidad !== CODIGO_COLOMBIA)
      err("codigo_pais_nacionalidad", "Con cédula de ciudadanía la nacionalidad es Colombiana");
    if (v.fecha_nacimiento >= hoy) err("fecha_nacimiento", "La fecha de nacimiento debe ser anterior a hoy");
    if (v.fecha_expedicion_documento > hoy) err("fecha_expedicion_documento", "La fecha de expedición no puede ser futura");
    else if (v.fecha_expedicion_documento < v.fecha_nacimiento)
      err("fecha_expedicion_documento", "La expedición no puede ser anterior al nacimiento");
  })
  .transform((v) => ({
    ...v,
    tipo_documento_otro: v.tipo_documento === "otro" ? v.tipo_documento_otro : null,
    nacionalidad: NACIONALIDAD.get(v.codigo_pais_nacionalidad) ?? "",
  }));

export type Hogar = z.output<typeof hogarSchema>;
