// Chapter > subchapter > item hierarchy of the LISTADO DE PRECIOS, for the activity picker (SelectorApu).
import type { Apu } from "../domain/apus";
import { buscarApus, type OpcionApu } from "./armado";

export type Subcapitulo = { codigo: string; nombre: string; cantidad: number; items: Apu[] };
export type CapituloApu = { codigo: string; nombre: string; cantidad: number; subcapitulos: Subcapitulo[] };
export type Ambito = { capitulo: string; subcapitulo?: string };

const subDe = (a: Apu) => a.subcapitulo ?? a.capitulo;
const subNombreDe = (a: Apu) => (a.subcapitulo ? (a.subcapitulo_nombre ?? a.subcapitulo) : a.capitulo_nombre);
const porCodigo = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });

/**
 * Chapter order: the trade chapters 10-53 first (the building work an inspector prices most), then the numeric
 * chapters 01-09 (preliminaries and general works), then the sub-mix list ME, the SVSH list and the untitled SIM
 * infrastructure list last; other letter chapters sit with ME. Ties sort by code, numeric-aware.
 */
function grupo(codigo: string): number {
  if (/^\d+$/.test(codigo)) return Number(codigo) >= 10 ? 0 : 1;
  return codigo === "SVSH" ? 3 : codigo === "SIM" ? 4 : 2;
}

export function arbolApus(apus: readonly Apu[]): CapituloApu[] {
  const caps = new Map<string, { nombre: string; subs: Map<string, Subcapitulo> }>();
  for (const a of apus) {
    let c = caps.get(a.capitulo);
    if (!c) caps.set(a.capitulo, (c = { nombre: a.capitulo_nombre, subs: new Map() }));
    const codigo = subDe(a);
    let s = c.subs.get(codigo);
    if (!s) c.subs.set(codigo, (s = { codigo, nombre: subNombreDe(a), cantidad: 0, items: [] }));
    s.items.push(a);
    s.cantidad++;
  }
  return [...caps]
    .map(([codigo, c]) => {
      const subcapitulos = [...c.subs.values()].sort((x, y) => porCodigo(x.codigo, y.codigo));
      for (const s of subcapitulos) s.items.sort((x, y) => porCodigo(x.item, y.item));
      return { codigo, nombre: c.nombre, cantidad: subcapitulos.reduce((n, s) => n + s.cantidad, 0), subcapitulos };
    })
    .sort((x, y) => grupo(x.codigo) - grupo(y.codigo) || porCodigo(x.codigo, y.codigo));
}

/** "20 Pisos" (the name alone when it already is the code). */
export const etiqueta = (codigo: string, nombre: string) => (nombre === codigo ? codigo : `${codigo} ${nombre}`);

/** "20 Pisos › 2001 Bases-placas-andenes"; lists without subchapters show the chapter only. */
export function rutaApu(a: Apu): string {
  const cap = etiqueta(a.capitulo, a.capitulo_nombre);
  return subDe(a) === a.capitulo ? cap : `${cap} › ${etiqueta(subDe(a), subNombreDe(a))}`;
}

/** buscarApus (ITEM prefix or accent-insensitive words, 2+ characters) limited to a chapter or subchapter. */
export function buscarEnArbol(opciones: readonly OpcionApu[], consulta: string, ambito?: Ambito, limite = 50): Apu[] {
  const dentro = ambito
    ? opciones.filter((o) => o.apu.capitulo === ambito.capitulo && (!ambito.subcapitulo || subDe(o.apu) === ambito.subcapitulo))
    : opciones;
  return buscarApus(dentro as OpcionApu[], consulta, limite);
}
