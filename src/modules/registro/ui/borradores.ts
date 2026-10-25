// Draft persistence in IndexedDB (idb-keyval). One draft slot per user, so a shared PC never mixes staff drafts.
// Note: drafts hold personal data on this device until submitted or discarded.
import { del, get, set } from "idb-keyval";
import type { Marca, Valores } from "./pasos";

export type Borrador = {
  /** Client-generated at draft start; later the record id (create idempotency key). */
  id: string;
  valores: Valores;
  paso: string;
  /** Furthest step index reached. */
  maximo: number;
  marcas: Record<string, Marca>;
  guardado_en: string;
};

const clave = (uid: string) => `borrador:${uid}`;

export const cargarBorrador = (uid: string) => get<Borrador>(clave(uid));
export const guardarBorrador = (uid: string, b: Borrador) => set(clave(uid), b);
export const descartarBorrador = (uid: string) => del(clave(uid));
