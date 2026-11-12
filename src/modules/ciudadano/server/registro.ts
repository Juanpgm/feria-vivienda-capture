// Server-only: the citizen registro. One per document (deterministic id) and ONE later edit, both enforced inside
// transactions. Identity (name, document) always comes from the eligibility list, never from the client.
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { calcularEdad } from "@/modules/composicion/domain/derivaciones";
import type { RegistroDatos } from "@/modules/registro/domain/schema";
import { formatearRadicado } from "@/modules/registro/domain/radicado";
import { buscarDuplicados, camposDeDatos, marcarAdjuntosCompletos, requeridosDe, VERSION_ESQUEMA, type Actor } from "@/modules/registro/server/registro.repo";
import { radicadoPrefijo } from "@/shared/config";
import { ESTADO_REVISION_INICIAL } from "@/shared/constantes";
import { adminDb } from "@/shared/firebase/admin";
import { fechaBogota } from "@/shared/tiempo";
import { separarNombre } from "../domain/nombre";
import { refCiudadano, registroIdDe, type Ciudadano } from "./ciudadanos.repo";
import { CiudadanoError } from "./sesion";

/** Shared bucket: the dashboard groups every citizen registro under one "Ciudadano" row. */
export const UID_CIUDADANO = "ciudadano";
export const NOMBRE_CIUDADANO = "Ciudadano";
const actorCiudadano: Actor = { uid: UID_CIUDADANO, rol: "usuario", correo: "" };

const refRegistro = (id: string) => adminDb().collection("registros").doc(id);
const refContador = () => adminDb().collection("contadores").doc("radicado");
const aIso = (t: unknown) => (t && typeof (t as { toDate?: () => Date }).toDate === "function" ? (t as { toDate: () => Date }).toDate().toISOString() : null);

/** Identity fields of `solicitante`, taken from the list: whatever the client sent for them is overwritten. */
export const identidadDe = (c: Ciudadano) => ({ ...separarNombre(c.nombre), numero_documento: c.documento });

export type EstadoCiudadano =
  | { tipo: "nuevo"; registroId: string }
  | { tipo: "ya_registrado_otro"; radicado: string }
  | { tipo: "registrado"; radicado: string; registrado_en: string | null; puedeEditar: boolean; registroId: string; valores: Record<string, unknown> | null };

export async function estadoCiudadano(c: Ciudadano): Promise<EstadoCiudadano> {
  const registroId = registroIdDe(c.documento);
  if (c.registro_id) {
    const x = (await refRegistro(registroId).get()).data();
    if (x && (x.adjuntos_completos === true || (c.ediciones_usadas ?? 0) > 0)) {
      const puedeEditar = (c.ediciones_usadas ?? 0) === 0 && x.estado_revision === ESTADO_REVISION_INICIAL;
      return { tipo: "registrado", radicado: String(x.radicado), registrado_en: aIso(x.registrado_en), puedeEditar, registroId, valores: puedeEditar ? (x.valores_formulario ?? null) : null };
    }
    return { tipo: "nuevo", registroId }; // creation was interrupted: resume it
  }
  // Someone (a funcionario) already registered this document: the citizen cannot add another one.
  const otros = await buscarDuplicados(c.documento, { excluirId: registroId });
  return otros.length ? { tipo: "ya_registrado_otro", radicado: otros[0].radicado } : { tipo: "nuevo", registroId };
}

/**
 * Create (or resume an unfinished create) and, with `edicion`, the single edit. `valores` is the raw form state, kept so
 * the edit can reopen the form exactly as it was sent.
 */
export async function guardarRegistroCiudadano(datos: RegistroDatos, c: Ciudadano, edicion: boolean, valores: Record<string, unknown>) {
  const { id, ...dominios } = datos;
  if (id !== registroIdDe(c.documento) || dominios.solicitante.numero_documento !== c.documento) throw new CiudadanoError(403, "Registro no autorizado");
  if (dominios.firma.metodo_firma !== "dibujada") throw new CiudadanoError(422, "Debe firmar en pantalla");

  const estado = await estadoCiudadano(c);
  if (estado.tipo === "ya_registrado_otro") throw new CiudadanoError(409, `Ya existe un registro con su documento (radicado ${estado.radicado}).`);

  const ref = refRegistro(id);
  const refC = refCiudadano(c.documento);
  const hoy = fechaBogota();
  const edad = calcularEdad(datos.solicitante.fecha_nacimiento, hoy);
  const campos = camposDeDatos(dominios, actorCiudadano, NOMBRE_CIUDADANO, edad);
  const hash = createHash("sha256").update(JSON.stringify(dominios)).digest("hex");

  const radicado = await adminDb().runTransaction(async (tx) => {
    const [r, cd, contador] = await Promise.all([tx.get(ref), tx.get(refC), tx.get(refContador())]);
    const ciu = cd.data();
    if (!ciu) throw new CiudadanoError(403, "Registro no autorizado");
    const usadas = (ciu.ediciones_usadas as number | undefined) ?? 0;

    if (!r.exists) {
      const numero = ((contador.data()?.ultimo as number | undefined) ?? 0) + 1;
      const rad = formatearRadicado(radicadoPrefijo(), numero);
      tx.set(refContador(), { ultimo: numero, actualizado_en: FieldValue.serverTimestamp() });
      tx.create(ref, {
        ...campos,
        valores_formulario: valores,
        id,
        radicado: rad,
        radicado_numero: numero,
        creado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
        registrado_en: FieldValue.serverTimestamp(),
        fecha_registro_bogota: hoy,
        fuente: "ciudadano",
        version_esquema: VERSION_ESQUEMA,
        registrado_por_uid: UID_CIUDADANO,
        registrado_por_nombre: NOMBRE_CIUDADANO,
        registrado_por_correo: "",
        adjuntos_requeridos: requeridosDe("dibujada").length,
        adjuntos_presentes: 0,
        adjuntos_completos: false,
        estado: "registrado",
        estado_revision: ESTADO_REVISION_INICIAL,
        estado_revision_en: FieldValue.serverTimestamp(),
        estado_revision_por_uid: UID_CIUDADANO,
        estado_revision_por_correo: "",
      });
      tx.create(ref.collection("historial").doc(), { tipo: "creacion", estado_revision: ESTADO_REVISION_INICIAL, por_uid: UID_CIUDADANO, por_nombre: NOMBRE_CIUDADANO, por_correo: "", en: FieldValue.serverTimestamp() });
      tx.update(refC, { registro_id: id, radicado: rad, ediciones_usadas: 0, adjuntos_abiertos: true });
      return rad;
    }

    const x = r.data()!;
    const rad = String(x.radicado);
    if (x.adjuntos_completos !== true && usadas === 0) {
      // Creation never finished (lost connection): the retry replaces the data, same radicado, no edit consumed.
      tx.update(ref, { ...campos, valores_formulario: valores, actualizado_en: FieldValue.serverTimestamp() });
      tx.update(refC, { adjuntos_abiertos: true });
      return rad;
    }
    if (!edicion) throw new CiudadanoError(409, "Usted ya tiene un registro enviado.");
    if (usadas === 0) {
      if (x.estado_revision !== ESTADO_REVISION_INICIAL) throw new CiudadanoError(409, "Su registro ya está en revisión y no puede modificarse.");
      tx.update(ref, { ...campos, valores_formulario: valores, actualizado_en: FieldValue.serverTimestamp(), ediciones_ciudadano: 1 });
      tx.create(ref.collection("historial").doc(), { tipo: "edicion_ciudadano", estado_revision: x.estado_revision, por_uid: UID_CIUDADANO, por_nombre: NOMBRE_CIUDADANO, por_correo: "", en: FieldValue.serverTimestamp() });
      tx.update(refC, { ediciones_usadas: 1, edicion_hash: hash, adjuntos_abiertos: true });
      return rad;
    }
    // Same payload re-sent after a failed upload of the edit: allowed, nothing new is consumed.
    if (usadas === 1 && ciu.edicion_hash === hash && ciu.adjuntos_abiertos === true) return rad;
    throw new CiudadanoError(409, "Ya usó la oportunidad de modificar su registro.");
  });
  return { id, radicado, registrado_en: aIso((await ref.get()).data()?.registrado_en) };
}

/** Same server-side completeness check as the funcionario flow; closes the upload window once everything is there. */
export async function completarCiudadano(c: Ciudadano) {
  const id = registroIdDe(c.documento);
  if (!c.registro_id) throw new CiudadanoError(404, "Registro no encontrado");
  const r = await marcarAdjuntosCompletos(id, actorCiudadano);
  if (!r) throw new CiudadanoError(404, "Registro no encontrado");
  if (r.completo) await refCiudadano(c.documento).update({ adjuntos_abiertos: false });
  return r;
}
