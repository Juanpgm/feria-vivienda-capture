import { adminDb } from "@/shared/firebase/admin";
import type { Apu } from "../domain/apus";

/** Firestore collection loaded by scripts/importar-apus.mjs. */
export const COLECCION_APUS = "APUS";
const VIGENCIA_MS = 10 * 60_000;

// ponytail: per-instance cache (~3.8k docs, one full read per instance every 10 min); prices change only on re-import.
let cache: { en: number; apus: Apu[]; porItem: Map<string, Apu> } | null = null;

async function cargar() {
  if (cache && Date.now() - cache.en < VIGENCIA_MS) return cache;
  const snap = await adminDb().collection(COLECCION_APUS).get();
  const apus = snap.docs.map((d) => d.data() as Apu).sort((a, b) => a.item.localeCompare(b.item, "es", { numeric: true }));
  cache = { en: Date.now(), apus, porItem: new Map(apus.map((a) => [a.item, a])) };
  return cache;
}

export const listarApus = async () => (await cargar()).apus;

/** Server-side price source for a visit's rows (the client's prices are never trusted). */
export const apusPorItem = async () => (await cargar()).porItem;

export const limpiarCacheApus = () => {
  cache = null;
};
