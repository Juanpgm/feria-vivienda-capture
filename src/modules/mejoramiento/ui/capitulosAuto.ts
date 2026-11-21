// Budget chapters that follow "Sí, para": one chapter per improvement category (APLICA_PARA), named like the
// PRESUPUESTO TOPOP sheet (PISO, BAÑO, ...), plus free-name extra chapters. Pure helpers, kept in two-way sync.
import type { Apu } from "../domain/apus";
import { APLICA_PARA, aplicaDeCapitulo, type ClaveAplica } from "../domain/catalogos";
import type { Capitulo } from "./armado";

const CLAVES = Object.keys(APLICA_PARA) as ClaveAplica[];
const PREFIJO = "ap-";

/** "PISO", "BAÑO", "ESPACIO 3X3": the category label uppercased like the budget sheet. */
export const nombreCategoria = (k: ClaveAplica) => APLICA_PARA[k].toLocaleUpperCase("es-CO");
export const idCategoria = (k: ClaveAplica) => `${PREFIJO}${k}`;

const esClave = (k: string): k is ClaveAplica => k in APLICA_PARA;

/** Category of a chapter: by its stable id, else (old drafts, manual chapters) by its name. */
export function claveDeCapitulo(c: Capitulo): ClaveAplica | undefined {
  if (c.id.startsWith(PREFIJO)) {
    const k = c.id.slice(PREFIJO.length);
    if (esClave(k)) return k;
  }
  return aplicaDeCapitulo(c.nombre);
}

/** Categories in APLICA_PARA order (drops unknown keys and repeats). */
export const ordenarAplica = (aplicaPara: readonly string[]): ClaveAplica[] => CLAVES.filter((k) => aplicaPara.includes(k));

/**
 * Chapters for the selected categories: one per category in APLICA_PARA order (reusing the chapter that already maps
 * to it, else an empty one); a category no longer selected keeps its chapter only while it has rows. Then the extra
 * chapters in their order. The first chapter mapping to a category owns it; later ones stay extra.
 */
export function sincronizarCapitulos(aplicaPara: readonly string[], capitulos: readonly Capitulo[]): Capitulo[] {
  const elegidas = new Set(ordenarAplica(aplicaPara));
  const porClave = new Map<ClaveAplica, Capitulo>();
  const extras: Capitulo[] = [];
  for (const c of capitulos) {
    const k = claveDeCapitulo(c);
    if (k && !porClave.has(k)) porClave.set(k, c);
    else extras.push(c);
  }
  const categorias = CLAVES.flatMap((k): Capitulo[] => {
    const c = porClave.get(k);
    if (!elegidas.has(k) && !c?.filas.length) return [];
    return [{ id: idCategoria(k), nombre: nombreCategoria(k), filas: c?.filas ?? [] }];
  });
  return [...categorias, ...extras];
}

/** An automatic category chapter (as opposed to a free-name extra chapter). */
export const esCategoria = (c: Capitulo) => c.id.startsWith(PREFIJO) && esClave(c.id.slice(PREFIJO.length));

/** A category chapter kept for its rows although its category is not in "Sí, para". */
export const fueraDeAplica = (c: Capitulo, aplicaPara: readonly string[]) => esCategoria(c) && !aplicaPara.includes(c.id.slice(PREFIJO.length));

export type Presupuesto = { aplicaPara: string[]; capitulos: Capitulo[] };

/** "Agregar capítulo" of a category: marks it in "Sí, para" and adds its chapter. */
export function agregarCategoria(p: Presupuesto, k: ClaveAplica): Presupuesto {
  const aplicaPara = ordenarAplica([...p.aplicaPara, k]);
  return { aplicaPara, capitulos: sincronizarCapitulos(aplicaPara, p.capitulos) };
}

/** Free-name extra chapter at the end; it does not touch "Sí, para". A name of a category without its chapter yet
 * ("Cocina") adds that category instead, so names and categories never diverge. */
export function agregarExtra(p: Presupuesto, nombre: string, id: string): Presupuesto & { id: string } {
  const k = aplicaDeCapitulo(nombre);
  if (k && !p.capitulos.some((c) => c.id === idCategoria(k))) return { ...agregarCategoria(p, k), id: idCategoria(k) };
  return { ...p, capitulos: [...p.capitulos, { id, nombre: nombre.trim(), filas: [] }], id };
}

export const SIN_CATEGORIAS = "Debe quedar al menos una mejora en «Sí, para». Marque otra antes de quitar este capítulo.";

/** Removes a chapter; a category chapter also leaves "Sí, para", which never becomes empty. */
export function quitarCapitulo(p: Presupuesto, id: string): Presupuesto | { error: string } {
  const c = p.capitulos.find((x) => x.id === id);
  if (!c) return p;
  const capitulos = p.capitulos.filter((x) => x.id !== id);
  const k = c.id.slice(PREFIJO.length);
  if (!esCategoria(c) || !p.aplicaPara.includes(k)) return { ...p, capitulos };
  const aplicaPara = p.aplicaPara.filter((x) => x !== k);
  if (!aplicaPara.length) return { error: SIN_CATEGORIAS };
  return { aplicaPara, capitulos };
}

const normalizar = (s = "") => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Words of a price-list chapter/subchapter name that point at a category without doubt.
const PALABRAS: Partial<Record<ClaveAplica, readonly string[]>> = {
  piso: ["piso"],
  bano: ["bano", "sanitari", "lavamanos", "ducha"],
  cocina: ["cocina", "lavaplatos", "meson"],
  cubierta: ["cubierta", "teja"],
  acabado_muros: ["pintura", "estuco", "repello", "panete"],
  alcantarillado_piso: ["alcantarill"],
};

/** Category of an APU by its price-list chapter and subchapter names (e.g. 20 PISOS -> piso); undefined if not obvious. */
export function categoriaDeApu(a: Apu): ClaveAplica | undefined {
  const ruta = normalizar(`${a.capitulo_nombre} ${a.subcapitulo_nombre ?? ""}`);
  const k = (Object.keys(PALABRAS) as ClaveAplica[]).filter((x) => PALABRAS[x]!.some((p) => ruta.includes(p)));
  return k.length === 1 ? k[0] : undefined;
}

/** Default target chapter of an APU: its category chapter, else the last chapter used, else the first. */
export function capituloPorDefecto(a: Apu, capitulos: readonly Capitulo[], ultimo?: string): string | undefined {
  const k = categoriaDeApu(a);
  const propio = k && capitulos.find((c) => c.id === idCategoria(k));
  if (propio) return propio.id;
  return capitulos.find((c) => c.id === ultimo)?.id ?? capitulos[0]?.id;
}
