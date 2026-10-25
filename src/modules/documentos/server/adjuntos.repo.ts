// Server-only: stores/reads the images attached to a registro (document photos, signature).
// Layout: registros/{id}/adjuntos/{tipo} = metadata + `datos` (raw bytes). Nothing here ever returns the image to
// the uploader; only admin+ read it through GET .../adjuntos/{tipo}, and every read leaves an access-log entry in
// registros/{id}/accesos_adjuntos (firestore.rules denies clients everything, so only this server code touches them).
// Size budget: a Firestore document holds 1 MiB. Bytes are stored raw (not base64), so a 700 KB photo (900 KB server
// cap) plus a few metadata fields stays below the limit. Above that, move the bytes to Firebase Storage.
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/shared/firebase/admin";
import { detectarFormato, esMimeAdmitido, MAX_BYTES_SERVIDOR, TIPOS_ADJUNTO, type MimeImagen, type TipoAdjunto } from "../domain/imagen";

export class AdjuntoError extends Error {
  constructor(
    readonly status: 404 | 413 | 422,
    message: string,
  ) {
    super(message);
  }
}

type Actor = { uid: string; correo: string };

/** Largest base64 text we even try to decode (900 KB of bytes + data-URL prefix slack). */
export const MAX_BASE64_CHARS = Math.ceil((900 * 1024) / 3) * 4 + 256;

export const adjuntoEntradaSchema = z.object({
  tipo: z.enum(TIPOS_ADJUNTO, { error: "Tipo de adjunto no válido" }),
  imagen: z.string({ error: "Falta la imagen" }).min(1, "Falta la imagen"),
});

export type AdjuntoValidado = { tipo: TipoAdjunto; mime: MimeImagen; datos: Buffer };

/** Validates the raw request body: schema, base64, per-type size cap and magic bytes (declared types are never trusted). */
export function validarAdjunto(cuerpo: unknown): AdjuntoValidado {
  const { tipo, imagen } = adjuntoEntradaSchema.parse(cuerpo);
  if (imagen.length > MAX_BASE64_CHARS) throw new AdjuntoError(413, "La imagen es demasiado grande");
  const base64 = imagen.replace(/^data:[^;,]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) throw new AdjuntoError(422, "La imagen no es válida");
  const datos = Buffer.from(base64, "base64");
  const tope = MAX_BYTES_SERVIDOR[tipo];
  if (datos.length > tope) throw new AdjuntoError(413, `La imagen supera el tamaño máximo (${Math.round(tope / 1024)} KB)`);
  const formato = detectarFormato(datos);
  if (!esMimeAdmitido(formato)) throw new AdjuntoError(422, "El archivo no es una imagen válida (JPEG, PNG o WebP)");
  return { tipo, mime: formato, datos };
}

const registroRef = (id: string) => adminDb().collection("registros").doc(id);

/**
 * Idempotent upsert. Only the funcionario who created the registro may attach to it; a registro that does not exist
 * or belongs to someone else is the same 404. Re-sending identical bytes changes nothing (keeps the first timestamp).
 */
export async function guardarAdjunto(registroId: string, a: AdjuntoValidado, actor: Actor) {
  const reg = registroRef(registroId);
  const r = await reg.get();
  if (!r.exists || r.data()?.registrado_por_uid !== actor.uid) throw new AdjuntoError(404, "Registro no encontrado");

  const sha256 = createHash("sha256").update(a.datos).digest("hex");
  const ref = reg.collection("adjuntos").doc(a.tipo);
  const previo = await ref.get();
  const resumen = { tipo: a.tipo, mime: a.mime, bytes: a.datos.length, sha256 };
  if (previo.exists && previo.data()?.sha256 === sha256) return { ...resumen, sin_cambios: true };

  await ref.set({
    ...resumen,
    datos: a.datos,
    subido_en: FieldValue.serverTimestamp(),
    subido_por_uid: actor.uid,
    subido_por_correo: actor.correo,
  });
  return { ...resumen, sin_cambios: false };
}

/** Admin+ read. Logs the access BEFORE returning the bytes: if the log cannot be written, nothing is served. */
export async function leerAdjunto(registroId: string, tipo: TipoAdjunto, actor: Actor, userAgent: string) {
  const reg = registroRef(registroId);
  const snap = await reg.collection("adjuntos").doc(tipo).get();
  const d = snap.data();
  if (!snap.exists || !d) return null;
  await reg.collection("accesos_adjuntos").add({
    uid: actor.uid,
    correo: actor.correo,
    tipo,
    accedido_en: FieldValue.serverTimestamp(),
    user_agent: userAgent.slice(0, 200),
  });
  return { mime: String(d.mime), datos: Buffer.from(d.datos) };
}
