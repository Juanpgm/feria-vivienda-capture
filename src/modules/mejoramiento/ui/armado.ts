// Pure helpers of the visit form: form state shape, step validation, APU search and the submit manifest.
import { filtrarOpciones, type OpcionBusqueda } from "@/shared/busqueda";
import type { Apu } from "../domain/apus";
import { evaluarCantidad } from "../domain/cantidad";
import { costoDirecto } from "../domain/costos";
import { OBSERVACIONES_PRESET } from "../domain/catalogos";
import type { ArchivoManifiesto } from "../domain/envio";
import { visitaSchema, type VisitaEntrada } from "../domain/visita";

export type Fila = { id: string; item: string; cantidad_expr: string };
export type Capitulo = { id: string; nombre: string; filas: Fila[] };
/** Form state: strings as typed; empty selects are left undefined so optional answers stay absent. */
export type Valores = {
  id: string;
  atiende: { relacion?: string; relacion_otro?: string; nombre?: string; tipo_documento?: string; documento?: string; parentesco?: string };
  propietario: { nombre?: string; tipo_documento?: string; documento?: string; telefono?: string; correo?: string; direccion?: string; anios_habitando?: string; personas?: string };
  diagnostico: { aplica?: string; aplica_para: string[]; no_aplica_por?: string; alcance?: string; estados: Record<string, string | undefined>; detalles: Record<string, string | undefined> };
  capitulos: Capitulo[];
  observaciones: string;
};
/** Photo of a quantity row: bytes live in the photo store (fotosVisita.ts), keyed by `ref`. */
export type FotoMeta = { ref: string; mime: string; bytes: number };
export type FotosPorFila = Record<string, FotoMeta[]>;

export const visitaVacia = (id: string): Valores => ({
  id,
  atiende: {},
  propietario: {},
  diagnostico: { aplica_para: [], estados: {}, detalles: {} },
  capitulos: [],
  observaciones: OBSERVACIONES_PRESET,
});

export const aEntrada = (v: Valores) => v as unknown as VisitaEntrada;

/** Schema paths each step validates (the last step validates the whole visit). Step 1 "Anfitrión" = atiende + propietario. */
const PREFIJOS: readonly (readonly string[])[] = [["atiende", "propietario"], ["diagnostico"], ["capitulos"], []];

/** `{ "atiende.nombre": message }` of the given step (first message per path). */
export function erroresPaso(paso: number, v: Valores): Record<string, string> {
  const r = visitaSchema.safeParse(aEntrada(v));
  if (r.success) return {};
  const prefijos = PREFIJOS[paso] ?? [];
  const errores: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const ruta = issue.path.join(".");
    if (prefijos.length && !prefijos.some((p) => ruta === p || ruta.startsWith(`${p}.`))) continue;
    errores[ruta] ??= issue.message;
  }
  return errores;
}

export type OpcionApu = OpcionBusqueda & { apu: Apu };
export const opcionesApus = (apus: Apu[]): OpcionApu[] => apus.map((a) => ({ value: a.item, label: a.item, keywords: a.descripcion, apu: a }));

/** By ITEM or DESCRIPCION, accent insensitive; nothing until 2 characters are typed. */
export function buscarApus(opciones: OpcionApu[], consulta: string, limite = 20): Apu[] {
  if (consulta.trim().length < 2) return [];
  return filtrarOpciones(opciones, consulta, limite).map((o) => o.apu);
}

/** Shape of catalogo/sugeridos.json (scripts/build-sugeridos-apu.mjs). */
export type Sugeridos = { comunes: string[]; por_capitulo: Partial<Record<string, string[]>> };

/** "Frecuentes" of the add flow: the frequent ITEMs of each selected improvement (APLICA_PARA order as given), then
 * the common ones; only APUs in the loaded price list, without repeats, at most `limite`. */
export function actividadesFrecuentes(aplicaPara: readonly string[], sugeridos: Sugeridos, mapa: Map<string, Apu>, limite = 10): Apu[] {
  const items = new Set([...aplicaPara.flatMap((k) => sugeridos.por_capitulo[k] ?? []), ...sugeridos.comunes]);
  return [...items].filter((i) => mapa.has(i)).slice(0, limite).map((i) => mapa.get(i)!);
}

/** CANTIDAD and PRECIO TOTAL of a budget table row; `error` stays empty while nothing is typed yet. */
export function valorFila(cantidadExpr: string, apu?: Apu): { cantidad: number | null; error: string; total: number | null } {
  const r = evaluarCantidad(cantidadExpr);
  if (!r.ok) return { cantidad: null, error: cantidadExpr.trim() ? r.error : "", total: null };
  return { cantidad: r.valor, error: "", total: apu ? costoDirecto(r.valor, apu.costo_unitario) : null };
}

export const conteosFotos = (capitulos: Capitulo[], fotos: FotosPorFila) => capitulos.flatMap((c) => c.filas.map((f) => fotos[f.id]?.length ?? 0));

/** Photos of the rows that still exist, then the single citizen signature (always PNG). */
export function construirManifiesto(capitulos: Capitulo[], fotos: FotosPorFila, bytesFirma: number): ArchivoManifiesto[] {
  const deFotos = capitulos.flatMap((c) =>
    c.filas.flatMap((f) =>
      (fotos[f.id] ?? []).map((p): ArchivoManifiesto => ({ ref: p.ref, tipo: "foto", fila_id: f.id, content_type: p.mime as "image/jpeg", bytes: p.bytes })),
    ),
  );
  return [...deFotos, { ref: "firma", tipo: "firma_ciudadano", content_type: "image/png", bytes: bytesFirma }];
}

/** The citizen signature travels as image/png only (the pad falls back to WebP for very heavy strokes). */
export function dataUrlAPng(url: string): Blob {
  const prefijo = "data:image/png;base64,";
  if (!url.startsWith(prefijo)) throw new Error("La firma debe ser una imagen PNG. Firme de nuevo.");
  const binario = atob(url.slice(prefijo.length));
  return new Blob([Uint8Array.from(binario, (c) => c.charCodeAt(0))], { type: "image/png" });
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0, minimumFractionDigits: 0 });
export const formatoCop = (n: number) => COP.format(n);
