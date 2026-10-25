import { adminDb } from "@/shared/firebase/admin";
import { agregar, type Alcance, type Dashboard, type RegistroMinimo } from "../domain/agregacion";
import type { FiltrosDashboard } from "../domain/filtros";

/** Only these fields are read from Firestore (projection): names, documents, phones and addresses never leave the DB. */
const CAMPOS = [
  "registrado_en",
  "fecha_registro_bogota",
  "estado",
  "estado_revision",
  "registrado_por_uid",
  "registrado_por_nombre",
  "registrado_por_correo",
  "inmueble.nombre_division",
  "inmueble.nombre_barrio_vereda",
  "inmueble.sector",
  "inmueble.estrato",
  "composicion.rango_ingresos_smlmv",
  "composicion.rango_tamano_hogar",
  "composicion.rango_adulto_mayor",
  "titularidad.tipo_titularidad",
  "riesgo.dictamen",
  "riesgo.esta_en_rud",
  "riesgo.rud_no_sabe",
  "cierre_financiero.tiene_seguro",
];

export const TTL_CACHE_MS = 60_000;
/** Minimum gap between two real Firestore reads on this instance, whoever asks ("Actualizar" included). */
export const INTERVALO_MIN_MS = 10_000;

type Cache = { en: number; registros: RegistroMinimo[] };
let cache: Cache | null = null;
let pendiente: Promise<Cache> | null = null;

/** Test helper. */
export const vaciarCache = () => {
  cache = null;
  pendiente = null;
};

const aIso = (t: unknown): string | null => (t && typeof (t as { toDate?: unknown }).toDate === "function" ? (t as { toDate(): Date }).toDate().toISOString() : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const minimo = (d: Record<string, any>): RegistroMinimo => ({
  registrado_en: aIso(d.registrado_en),
  fecha_registro_bogota: d.fecha_registro_bogota ?? null,
  estado: d.estado ?? null,
  estado_revision: d.estado_revision ?? null,
  registrado_por_uid: d.registrado_por_uid ?? null,
  registrado_por_nombre: d.registrado_por_nombre ?? null,
  registrado_por_correo: d.registrado_por_correo ?? null,
  comuna: d.inmueble?.nombre_division ?? null,
  barrio: d.inmueble?.nombre_barrio_vereda ?? null,
  sector: d.inmueble?.sector ?? null,
  estrato: d.inmueble?.estrato ?? null,
  rango_ingresos: d.composicion?.rango_ingresos_smlmv ?? null,
  rango_hogar: d.composicion?.rango_tamano_hogar ?? null,
  rango_adulto_mayor: d.composicion?.rango_adulto_mayor ?? null,
  titularidad: d.titularidad?.tipo_titularidad ?? null,
  dictamen: d.riesgo?.dictamen ?? null,
  en_rud: d.riesgo?.esta_en_rud ?? null,
  rud_no_sabe: d.riesgo?.rud_no_sabe ?? null,
  tiene_seguro: d.cierre_financiero?.tiene_seguro ?? null,
});

/**
 * Per-instance cache of the projected registros (~60 s). `refrescar` bypasses the TTL but not INTERVALO_MIN_MS, and
 * concurrent callers share one in-flight read. Role scoping happens afterwards, in `agregar`.
 * ponytail: full scan of the collection with select(); fine for low thousands of registros and one server instance
 * per region. Upgrade path: transactional counters written in the create batch (contadores/*, see design).
 */
export async function leerRegistros({ refrescar = false, ahora = Date.now() }: { refrescar?: boolean; ahora?: number } = {}): Promise<Cache> {
  if (pendiente) return pendiente;
  const espera = refrescar ? INTERVALO_MIN_MS : TTL_CACHE_MS;
  if (cache && ahora - cache.en < espera) return cache;
  pendiente = (async () => {
    const snap = await adminDb()
      .collection("registros")
      .select(...CAMPOS)
      .get();
    cache = { en: ahora, registros: snap.docs.map((d) => minimo(d.data())) };
    return cache;
  })().finally(() => {
    pendiente = null;
  });
  return pendiente;
}

/** Role-scoped dashboard. `filtros` are honored only for the full (admin+) scope. */
export async function obtenerDashboard(
  { alcance, uid, filtros = {} }: { alcance: Alcance; uid?: string; filtros?: Partial<FiltrosDashboard> },
  ahora = Date.now(),
): Promise<Dashboard> {
  const { en, registros } = await leerRegistros({ refrescar: filtros.refrescar === "1", ahora });
  return agregar(registros, {
    alcance,
    uid,
    desde: filtros.desde,
    hasta: filtros.hasta,
    funcionario: filtros.funcionario,
    generadoEn: new Date(en).toISOString(),
  });
}
