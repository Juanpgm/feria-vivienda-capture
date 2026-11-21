// Field visits (collection visitas_mejoramiento). Lifecycle:
//   POST /api/visitas            -> doc created with estado "archivos_pendientes" + presigned PUTs (idempotent by id)
//   browser PUTs files to S3
//   POST /api/visitas/{id}/confirmar -> every expected object verified (HeadObject) -> estado "registrada"
//   croquis later                -> tiene_croquis true
import { FieldValue } from "firebase-admin/firestore";
import { formatearRadicado } from "@/modules/registro/domain/radicado";
import { adminDb } from "@/shared/firebase/admin";
import { isoBogota } from "@/shared/tiempo";
import type { ArchivoAsignado, UbicacionGps } from "../domain/envio";
import type { Ubicacion } from "../domain/geo";
import type { Visita, FilaPresupuesto } from "../domain/visita";

export const COLECCION_VISITAS = "visitas_mejoramiento";
export const PREFIJO_VISITA = "MV";
/** Test accounts (usuarios/{uid}.prueba) number from MV-020001, like postulaciones. */
export const BASE_PRUEBAS = 20_000;

export type EstadoVisita = "archivos_pendientes" | "registrada";

export type Inspector = { uid: string; nombre: string; correo: string; cargo: string | null; firma_key: string };

export type VisitaDoc = Omit<Visita, "capitulos"> & {
  codigo: string;
  numero: number;
  prueba: boolean;
  estado: EstadoVisita;
  tiene_croquis: boolean;
  croquis: { key: string; content_type: string; bytes: number }[];
  /** Keys handed out by POST /croquis and not yet confirmed. */
  croquis_pendiente?: ArchivoCroquis[];
  croquis_por_uid?: string;
  inspector: Inspector;
  capitulos: { id: string; nombre: string; subtotal: number; filas: FilaPresupuesto[] }[];
  costo_directo_total: number;
  ubicacion: UbicacionGps & Ubicacion;
  archivos: ArchivoAsignado[];
  /** Visit date/time (America/Bogota, ISO 8601) stamped by the server. */
  fecha_visita: string;
};

export type ArchivoCroquis = { ref: string; key: string; content_type: string; bytes: number };

/** Compact row of the visit lists (no file keys, no personal data beyond what the list shows). */
export type FilaVisita = {
  id: string;
  codigo: string;
  fecha_visita: string;
  estado: EstadoVisita;
  tiene_croquis: boolean;
  propietario: { nombre: string; documento: string };
  direccion: string;
  comuna: string | null;
  barrio: string | null;
  costo_directo_total: number;
  inspector: { uid: string; nombre: string };
  prueba: boolean;
};

/** Visit scope of the caller: the inspector's uid, or null for admin/superadmin (every visit). */
export type Alcance = string | null;
export const visible = (v: Pick<VisitaDoc, "inspector">, alcance: Alcance) => alcance === null || v.inspector.uid === alcance;

const db = () => adminDb();
export const colVisitas = () => db().collection(COLECCION_VISITAS);

export class VisitaError extends Error {
  constructor(
    readonly status: 403 | 404 | 409 | 422,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Nueva = Omit<VisitaDoc, "codigo" | "numero" | "prueba" | "estado" | "tiene_croquis" | "croquis" | "archivos" | "fecha_visita">;

/**
 * Creates the visit (or returns the existing one for a retry of the same id). The code is taken from the counter in
 * the same transaction, so two submits never share a code. `planear(codigo)` assigns the S3 keys.
 */
export async function crearVisita(id: string, datos: Nueva, planear: (codigo: string) => ArchivoAsignado[]) {
  const ref = colVisitas().doc(id);
  const prueba = (await db().collection("usuarios").doc(datos.inspector.uid).get()).data()?.prueba === true;
  const contadorRef = db().collection("contadores").doc(prueba ? "visitas_mejoramiento_pruebas" : "visitas_mejoramiento");
  return db().runTransaction(async (tx) => {
    const [existente, contador] = await Promise.all([tx.get(ref), tx.get(contadorRef)]);
    if (existente.exists) {
      const v = existente.data() as VisitaDoc;
      if (v.inspector.uid !== datos.inspector.uid) throw new VisitaError(409, "Identificador de visita en uso");
      if (v.estado === "registrada") return { codigo: v.codigo, archivos: [] as ArchivoAsignado[], registrada: true, reintento: true };
      // Retry of a submit whose files did not all arrive: same code, the (possibly corrected) data and keys.
      const archivos = planear(v.codigo);
      tx.update(ref, { ...datos, archivos, actualizado_en: FieldValue.serverTimestamp() });
      return { codigo: v.codigo, archivos, registrada: false, reintento: true };
    }
    const numero = ((contador.data()?.ultimo as number | undefined) ?? (prueba ? BASE_PRUEBAS : 0)) + 1;
    const codigo = formatearRadicado(PREFIJO_VISITA, numero);
    const archivos = planear(codigo);
    tx.set(contadorRef, { ultimo: numero, actualizado_en: FieldValue.serverTimestamp() });
    tx.create(ref, {
      ...datos,
      id,
      codigo,
      numero,
      prueba,
      estado: "archivos_pendientes" satisfies EstadoVisita,
      tiene_croquis: false,
      croquis: [],
      archivos,
      fecha_visita: isoBogota(),
      creada_en: FieldValue.serverTimestamp(),
    });
    return { codigo, archivos, registrada: false, reintento: false };
  });
}

/** Visit ids are client UUIDs; anything else (e.g. a "/" from a URL) is simply not found. */
const idValido = (id: string) => /^[A-Za-z0-9-]{1,60}$/.test(id);

export async function obtenerVisita(id: string): Promise<VisitaDoc | null> {
  if (!idValido(id)) return null;
  const s = await colVisitas().doc(id).get();
  return s.exists ? (s.data() as VisitaDoc) : null;
}

export async function marcarRegistrada(id: string) {
  await colVisitas().doc(id).update({ estado: "registrada" satisfies EstadoVisita, registrada_en: FieldValue.serverTimestamp() });
}

export const LIMITE_LISTADO = 500;

const aFila = (id: string, v: VisitaDoc): FilaVisita => ({
  id,
  codigo: v.codigo,
  fecha_visita: v.fecha_visita,
  estado: v.estado,
  tiene_croquis: v.tiene_croquis === true,
  propietario: { nombre: v.propietario.nombre, documento: v.propietario.documento },
  direccion: v.propietario.direccion,
  comuna: v.ubicacion?.comuna_corregimiento?.nombre ?? null,
  barrio: v.ubicacion?.barrio_vereda?.nombre ?? null,
  costo_directo_total: v.costo_directo_total,
  inspector: { uid: v.inspector.uid, nombre: v.inspector.nombre },
  prueba: v.prueba === true,
});

/**
 * Newest first. With `uid`, only that inspector's visits: sorted in memory so no composite index is needed.
 * ponytail: 500 rows max (an inspector's first 500 by document order); paginate with a composite index
 * (inspector.uid + fecha_visita) when someone gets near that.
 */
export async function listarVisitas({ uid }: { uid?: string } = {}): Promise<FilaVisita[]> {
  const q = uid ? colVisitas().where("inspector.uid", "==", uid).limit(LIMITE_LISTADO) : colVisitas().orderBy("fecha_visita", "desc").limit(LIMITE_LISTADO);
  const filas = (await q.get()).docs.map((d) => aFila(d.id, d.data() as VisitaDoc));
  return uid ? filas.sort((a, b) => b.fecha_visita.localeCompare(a.fecha_visita)) : filas;
}

const noEncontrada = () => new VisitaError(404, "Visita no encontrada");

/** Hands out the croquis keys of a registered visit that has none yet; a retry replaces the pending set. */
export async function reservarCroquis(id: string, alcance: Alcance, planear: (codigo: string) => ArchivoCroquis[]) {
  if (!idValido(id)) throw noEncontrada();
  const ref = colVisitas().doc(id);
  return db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const v = s.exists ? (s.data() as VisitaDoc) : null;
    if (!v || !visible(v, alcance)) throw noEncontrada();
    if (v.estado !== "registrada") throw new VisitaError(409, "La visita aún tiene archivos pendientes; el croquis se carga cuando quede registrada");
    if (v.tiene_croquis) throw new VisitaError(409, "La visita ya tiene croquis cargado");
    const croquis = planear(v.codigo);
    tx.update(ref, { croquis_pendiente: croquis, actualizado_en: FieldValue.serverTimestamp() });
    return { codigo: v.codigo, croquis };
  });
}

const firmaDe = (a: ArchivoCroquis[]) => JSON.stringify(a.map(({ key, content_type, bytes }) => [key, content_type, bytes]));

/** Stores the croquis the caller verified in S3, only if that is still the pending set (no concurrent restart). */
export async function guardarCroquis(id: string, verificados: ArchivoCroquis[], porUid: string) {
  if (!idValido(id)) throw noEncontrada();
  const ref = colVisitas().doc(id);
  await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const v = s.exists ? (s.data() as VisitaDoc) : null;
    if (!v) throw noEncontrada();
    if (v.tiene_croquis) return;
    if (firmaDe(v.croquis_pendiente ?? []) !== firmaDe(verificados)) throw new VisitaError(409, "Los croquis cambiaron mientras se cargaban; intente de nuevo");
    tx.update(ref, {
      croquis: verificados.map(({ key, content_type, bytes }) => ({ key, content_type, bytes })),
      croquis_pendiente: [],
      tiene_croquis: true,
      croquis_cargado_en: FieldValue.serverTimestamp(),
      croquis_por_uid: porUid,
    });
  });
}
