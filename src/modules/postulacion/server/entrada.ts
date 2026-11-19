// Server-only: request body of create/edit -> validated envío. Nothing from the client is trusted: data is rebuilt with
// the domain schemas, images are decoded and checked by magic bytes (validarAdjunto).
import { z } from "zod";
import { consentimientoSchema } from "@/modules/consentimiento/domain/schema";
import { TIPOS_ADJUNTO, type TipoAdjunto } from "@/modules/documentos/domain/imagen";
import { validarAdjunto, type AdjuntoValidado } from "@/modules/documentos/server/adjuntos.repo";
import { firmaSchema } from "@/modules/firma/domain/schema";
import { armarDatos, validarSecciones, type Valores } from "../domain/armar";
import { PostulacionError, type Envio } from "./postulaciones.repo";

/** Data + 3 images in base64 stay well under the 4.5 MB request limit of the platform. */
export const MAX_CUERPO = 4 * 1024 * 1024;

const cuerpoSchema = z.object({
  valores: z.record(z.string(), z.record(z.string(), z.unknown())),
  adjuntos: z.partialRecord(z.enum(TIPOS_ADJUNTO), z.string()).default({}),
});

const invalido = (campos: Record<string, string>) => new PostulacionError(422, "Datos inválidos", { campos: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, [v]])) });

function imagenes(adjuntos: Partial<Record<TipoAdjunto, string>>): AdjuntoValidado[] {
  return Object.entries(adjuntos).map(([tipo, imagen]) => validarAdjunto({ tipo, imagen }));
}

/** Creation: every section must be valid; both ID photos and the signature image are mandatory (S16). */
export function entradaCreacion(cuerpo: unknown): Envio {
  const { valores, adjuntos } = cuerpoSchema.parse(cuerpo);
  const v = valores as Valores;
  const errores = validarSecciones(v, ["consentimiento", "declaracion"]);
  const firma = firmaSchema.safeParse(v.firma ?? {});
  // Only a signature image (drawn on screen or an uploaded image of a valid signature); no manual verification.
  if (!firma.success || firma.data.metodo_firma !== "dibujada") errores["firma.metodo_firma"] = "Firme en pantalla o suba una imagen de la firma";
  const datos = armarDatos(v);
  if (!datos.ok) Object.assign(errores, datos.errores);
  if (!adjuntos.documento_frente) errores["documentos.documento_frente"] = "Falta la foto del frente del documento";
  if (!adjuntos.documento_reverso) errores["documentos.documento_reverso"] = "Falta la foto del reverso del documento";
  if (firma.success && firma.data.metodo_firma === "dibujada" && !adjuntos.firma) errores["firma.imagen"] = "Falta la imagen de la firma";
  if (Object.keys(errores).length || !datos.ok || !firma.success) throw invalido(errores);
  return {
    datos: datos.datos,
    faltantes: datos.faltantes,
    consentimiento: consentimientoSchema.parse(v.consentimiento),
    firma: { ...firma.data, origen: v.firma?.origen === "imagen" ? "imagen" : "pantalla" },
    adjuntos: imagenes(adjuntos),
  };
}

/** Staff edit: data sections only; images are optional replacements. */
export function entradaEdicion(cuerpo: unknown) {
  const { valores, adjuntos } = cuerpoSchema.parse(cuerpo);
  const datos = armarDatos(valores as Valores);
  if (!datos.ok) throw invalido(datos.errores);
  const { firma: _firma, ...fotos } = adjuntos; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { datos: datos.datos, faltantes: datos.faltantes, adjuntos: imagenes(fotos) };
}

export const validacionSchema = z.object({
  confirmacion_paquete_completo: z.literal(true, { error: "Debe confirmar la recepción del paquete de documentación completo" }),
  acepta_responsabilidad: z.literal(true, { error: "Debe aceptar la responsabilidad sobre la información validada" }),
  folios_anexos: z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined || v === "" ? null : Number(v))).pipe(z.number().int().min(0).max(999).nullable()),
  firma: z.string({ error: "Falta la firma del funcionario" }).min(1, "Falta la firma del funcionario"),
});
