// Draft persistence in IndexedDB (idb-keyval). Staff attend several people at a fair, so a user has a LIST of drafts,
// each stored under its own key (`borrador:{uid}:{id}`): autosave of one draft never rewrites another, even with
// several tabs open. Keys carry the user id so a shared PC never mixes staff drafts.
// Note: drafts hold personal data on this device until submitted or discarded.
import { del, entries, get, set } from "idb-keyval";
import { PASOS, type Marca, type Valores } from "./pasos";

/** Bump when the shape of `valores` changes and add the step to `migrarBorrador`. */
export const VERSION_BORRADOR = 2;

export type Borrador = {
  /** Client-generated at draft start; later the record id (create idempotency key). */
  id: string;
  version: number;
  valores: Valores;
  paso: string;
  /** Furthest step index reached. */
  maximo: number;
  marcas: Record<string, Marca>;
  guardado_en: string;
};

export const claveBorrador = (uid: string, id: string) => `borrador:${uid}:${id}`;
const prefijo = (uid: string) => `borrador:${uid}:`;
/** Single-slot key used before the list existed. */
const claveLegada = (uid: string) => `borrador:${uid}`;

// ---- pure helpers (unit tested) ----

/** Best-effort split of a legacy full name: 1 word -> nombre; 2 -> nombre apellido; 3 -> nombre apellido apellido; 4+ -> 2 nombres, resto apellidos. */
export function partirNombre(completo: string): { primer_nombre: string; segundo_nombre: string; primer_apellido: string; segundo_apellido: string } {
  const p = completo.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 4) return { primer_nombre: p[0], segundo_nombre: p[1], primer_apellido: p[2], segundo_apellido: p.slice(3).join(" ") };
  if (p.length === 3) return { primer_nombre: p[0], segundo_nombre: "", primer_apellido: p[1], segundo_apellido: p[2] };
  return { primer_nombre: p[0] ?? "", segundo_nombre: "", primer_apellido: p[1] ?? "", segundo_apellido: "" };
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Brings a stored draft to the current shape; null when it is not a usable draft. Never throws. */
export function migrarBorrador(raw: unknown): Borrador | null {
  if (!esObjeto(raw) || typeof raw.id !== "string" || !esObjeto(raw.valores)) return null;
  const valores: Valores = {};
  for (const [k, v] of Object.entries(raw.valores)) valores[k] = esObjeto(v) ? { ...v } : {};
  const marcas = esObjeto(raw.marcas) ? ({ ...raw.marcas } as Record<string, Marca>) : {};
  const version = typeof raw.version === "number" ? raw.version : 1;

  if (version < 2) {
    const sol = valores.solicitante ?? {};
    if (typeof sol.nombre_completo === "string") Object.assign(sol, partirNombre(sol.nombre_completo));
    delete sol.nombre_completo;
    valores.solicitante = sol;
    const inm = valores.inmueble ?? {};
    // Free-text barrio no longer exists: the user must pick one from the list.
    if (inm.barrio_no_listado) delete marcas.inmueble;
    delete inm.barrio_no_listado;
    delete inm.barrio_vereda_otro;
    valores.inmueble = inm;
    // New required answer (única propiedad) lives in this step.
    delete marcas.titularidad;
  }

  const pasoValido = PASOS.some((p) => p.id === raw.paso);
  return {
    id: raw.id,
    version: VERSION_BORRADOR,
    valores,
    paso: pasoValido ? (raw.paso as string) : PASOS[0].id,
    maximo: typeof raw.maximo === "number" ? raw.maximo : 0,
    marcas,
    guardado_en: typeof raw.guardado_en === "string" ? raw.guardado_en : "",
  };
}

/** Most recently saved first; drafts never saved (empty date) go last. */
export const ordenarBorradores = (l: readonly Borrador[]): Borrador[] =>
  [...l].sort((a, b) => b.guardado_en.localeCompare(a.guardado_en));

/** Display data of a list row. */
export function resumenBorrador(b: Borrador) {
  const s = b.valores.solicitante ?? {};
  const texto = (k: string) => (typeof s[k] === "string" ? (s[k] as string).trim() : "");
  const nombre = [texto("primer_nombre"), texto("primer_apellido")].filter(Boolean).join(" ") || "Sin nombre";
  const indice = Math.max(0, PASOS.findIndex((p) => p.id === b.paso));
  return { id: b.id, nombre, numeroPaso: indice + 1, totalPasos: PASOS.length, paso: PASOS[indice].titulo, guardado_en: b.guardado_en };
}

/** `borradores` without the one with `id`. */
export const sinBorrador = (l: readonly Borrador[], id: string): Borrador[] => l.filter((b) => b.id !== id);

// ---- IndexedDB ----

/** Moves the legacy single-slot draft into the list (idempotent). */
async function migrarLegado(uid: string) {
  const viejo = migrarBorrador(await get(claveLegada(uid)));
  if (viejo) await set(claveBorrador(uid, viejo.id), viejo);
  await del(claveLegada(uid));
}

export async function listarBorradores(uid: string): Promise<Borrador[]> {
  await migrarLegado(uid);
  const todos = await entries();
  const propios = todos.flatMap(([k, v]) => (typeof k === "string" && k.startsWith(prefijo(uid)) ? [migrarBorrador(v)] : []));
  return ordenarBorradores(propios.filter((b): b is Borrador => b !== null));
}

export async function cargarBorrador(uid: string, id: string): Promise<Borrador | null> {
  await migrarLegado(uid);
  return migrarBorrador(await get(claveBorrador(uid, id)));
}
export const guardarBorrador = (uid: string, b: Omit<Borrador, "version">) => set(claveBorrador(uid, b.id), { ...b, version: VERSION_BORRADOR });
export const descartarBorrador = (uid: string, id: string) => del(claveBorrador(uid, id));
