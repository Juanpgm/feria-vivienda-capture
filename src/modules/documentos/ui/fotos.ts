// Photo storage of a draft: one IndexedDB entry per photo, keyed by the draft uuid. Deliberately NOT part of the draft
// record (`borrador:{uid}:{id}`), so listing drafts never loads image bytes. Removed when the draft is discarded or sent.
import { del, get, set } from "idb-keyval";
import { TIPOS_FOTO, type TipoFoto } from "../domain/imagen";

export type FotoGuardada = { blob: Blob; bytes: number; mime: string; ancho: number; alto: number; capturada_en: string };

const clave = (borradorId: string, tipo: TipoFoto) => `foto:${borradorId}:${tipo}`;

// Copy in memory: where IndexedDB is blocked or full (some in-app browsers, strict privacy settings) the photo still
// reaches the submit; only surviving a reload is lost. idb-keyval can throw synchronously, hence Promise.resolve().then.
const memoria = new Map<string, FotoGuardada>();
const idb = <T>(fn: () => Promise<T>) => Promise.resolve().then(fn).catch(() => undefined);

export const guardarFoto = async (borradorId: string, tipo: TipoFoto, f: FotoGuardada) => {
  memoria.set(clave(borradorId, tipo), f);
  await idb(() => set(clave(borradorId, tipo), f));
};
export const cargarFoto = async (borradorId: string, tipo: TipoFoto) => memoria.get(clave(borradorId, tipo)) ?? (await idb(() => get<FotoGuardada>(clave(borradorId, tipo))));
export const quitarFoto = async (borradorId: string, tipo: TipoFoto) => {
  memoria.delete(clave(borradorId, tipo));
  await idb(() => del(clave(borradorId, tipo)));
};
export const descartarFotos = (borradorId: string) => Promise.all(TIPOS_FOTO.map((t) => quitarFoto(borradorId, t))).then(() => undefined);
