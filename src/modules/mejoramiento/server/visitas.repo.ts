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
  inspector: Inspector;
  capitulos: { id: string; nombre: string; subtotal: number; filas: FilaPresupuesto[] }[];
  costo_directo_total: number;
  ubicacion: UbicacionGps & Ubicacion;
  archivos: ArchivoAsignado[];
  /** Visit date/time (America/Bogota, ISO 8601) stamped by the server. */
  fecha_visita: string;
};

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

export async function obtenerVisita(id: string): Promise<VisitaDoc | null> {
  const s = await colVisitas().doc(id).get();
  return s.exists ? (s.data() as VisitaDoc) : null;
}

export async function marcarRegistrada(id: string) {
  await colVisitas().doc(id).update({ estado: "registrada" satisfies EstadoVisita, registrada_en: FieldValue.serverTimestamp() });
}
