// Photo bytes of a visit draft: one IndexedDB entry per photo (`mv-foto:{visitaId}:{ref}`), kept out of the draft record
// so autosaving never rewrites image bytes. In-memory copy where IndexedDB is blocked (same approach as documentos/ui/fotos.ts).
import { del, get, set } from "idb-keyval";

const clave = (visitaId: string, ref: string) => `mv-foto:${visitaId}:${ref}`;
const memoria = new Map<string, Blob>();
const idb = <T>(fn: () => Promise<T>) => Promise.resolve().then(fn).catch(() => undefined);

export async function guardarFotoVisita(visitaId: string, ref: string, blob: Blob) {
  memoria.set(clave(visitaId, ref), blob);
  await idb(() => set(clave(visitaId, ref), blob));
}
export const cargarFotoVisita = async (visitaId: string, ref: string) => memoria.get(clave(visitaId, ref)) ?? (await idb(() => get<Blob>(clave(visitaId, ref))));
export async function quitarFotosVisita(visitaId: string, refs: string[]) {
  for (const ref of refs) memoria.delete(clave(visitaId, ref));
  await Promise.all(refs.map((ref) => idb(() => del(clave(visitaId, ref)))));
}
