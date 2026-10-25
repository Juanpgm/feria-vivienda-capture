// Photo storage of a draft: one IndexedDB entry per photo, keyed by the draft uuid. Deliberately NOT part of the draft
// record (`borrador:{uid}:{id}`), so listing drafts never loads image bytes. Removed when the draft is discarded or sent.
import { del, get, set } from "idb-keyval";
import { TIPOS_FOTO, type TipoFoto } from "../domain/imagen";

export type FotoGuardada = { blob: Blob; bytes: number; mime: string; ancho: number; alto: number; capturada_en: string };

const clave = (borradorId: string, tipo: TipoFoto) => `foto:${borradorId}:${tipo}`;

export const guardarFoto = (borradorId: string, tipo: TipoFoto, f: FotoGuardada) => set(clave(borradorId, tipo), f);
export const cargarFoto = (borradorId: string, tipo: TipoFoto) => get<FotoGuardada>(clave(borradorId, tipo));
export const quitarFoto = (borradorId: string, tipo: TipoFoto) => del(clave(borradorId, tipo));
export const descartarFotos = (borradorId: string) => Promise.all(TIPOS_FOTO.map((t) => quitarFoto(borradorId, t))).then(() => undefined);
