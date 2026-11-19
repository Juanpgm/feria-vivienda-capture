// Pure aggregation of postulaciones for the dashboard (S8). Input = the projected fields of each record.
import { RANGOS_SMLMV } from "@/modules/cierre-financiero/domain/smlmv";
import type { Item } from "@/modules/dashboard/domain/agregacion";
import { CONDICIONES_ESPECIALES, FUENTES_RECURSOS, GENEROS_SOLICITANTE, MODALIDADES, type FuenteRecurso } from "./catalogos";

export type FilaMetrica = {
  estado?: string;
  fecha_bogota?: string;
  origen?: string;
  faltantes?: { etiqueta: string }[];
  solicitante?: { nombre_division?: string | null; estrato?: number | null; genero?: string | null; condiciones_especiales?: string[]; sisben?: boolean | null; sisben_grupo?: string | null; caja_compensacion?: boolean | null };
  hogar?: { personas?: number; rango_ingresos_smlmv?: string };
  postulacion?: { modalidad?: string; recursos?: Partial<Record<string, { valor?: number | null }>>; total_aportes?: number };
  validado_por_nombre?: string;
};

const SIN = "sin_dato";
function contar(filas: FilaMetrica[], clave: (f: FilaMetrica) => string | string[] | null | undefined, etiquetas: Record<string, string> = {}, orden?: string[]): Item[] {
  const n = new Map<string, number>();
  for (const f of filas) {
    const v = clave(f);
    for (const k of Array.isArray(v) ? (v.length ? v : [SIN]) : [v ?? SIN]) n.set(String(k), (n.get(String(k)) ?? 0) + 1);
  }
  const items = [...n].map(([k, c]) => ({ clave: k, etiqueta: k === SIN ? "Sin dato" : (etiquetas[k] ?? k), n: c }));
  return orden ? items.sort((a, b) => orden.indexOf(a.clave) - orden.indexOf(b.clave)) : items.sort((a, b) => b.n - a.n);
}
const siNo = (v: boolean | null | undefined) => (v === true ? "si" : v === false ? "no" : null);
const SI_NO = { si: "Sí", no: "No" };

export function agregarPostulaciones(filas: FilaMetrica[], hoy: string, dias = 30) {
  const total = filas.length;
  const validas = filas.filter((f) => f.estado === "valido").length;
  const completas = filas.filter((f) => !f.faltantes?.length).length;
  const porDia = new Map<string, number>();
  for (const f of filas) if (f.fecha_bogota) porDia.set(f.fecha_bogota, (porDia.get(f.fecha_bogota) ?? 0) + 1);
  const serie = Array.from({ length: dias }, (_, i) => {
    const d = new Date(`${hoy}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (dias - 1 - i));
    const fecha = d.toISOString().slice(0, 10);
    return { fecha, n: porDia.get(fecha) ?? 0 };
  });
  const recursos = (Object.keys(FUENTES_RECURSOS) as FuenteRecurso[]).map((k) => {
    const con = filas.filter((f) => f.postulacion?.recursos?.[k]);
    return { clave: k, etiqueta: FUENTES_RECURSOS[k].etiqueta, n: con.length, monto: con.reduce((s, f) => s + (f.postulacion?.recursos?.[k]?.valor ?? 0), 0) };
  });
  const faltantes = new Map<string, number>();
  for (const f of filas) for (const x of f.faltantes ?? []) faltantes.set(x.etiqueta.replace(/^Integrante \d+: /, "Integrante: "), (faltantes.get(x.etiqueta.replace(/^Integrante \d+: /, "Integrante: ")) ?? 0) + 1);

  return {
    total,
    validas,
    sin_validar: total - validas,
    completas,
    publicas: filas.filter((f) => f.origen === "publico").length,
    personas: filas.reduce((s, f) => s + (f.hogar?.personas ?? 1), 0),
    aportes_total: filas.reduce((s, f) => s + (f.postulacion?.total_aportes ?? 0), 0),
    serie,
    por_estado: contar(filas, (f) => f.estado, { sin_validar: "Sin validar", valido: "Válido" }, ["sin_validar", "valido"]),
    por_modalidad: contar(filas, (f) => f.postulacion?.modalidad, Object.fromEntries(Object.entries(MODALIDADES).map(([k, v]) => [k, `${k}. ${v}`]))),
    por_comuna: contar(filas, (f) => f.solicitante?.nombre_division).slice(0, 12),
    por_estrato: contar(filas, (f) => (f.solicitante?.estrato ? String(f.solicitante.estrato) : null), {}, ["1", "2", "3", "4", "5", "6", SIN]),
    por_ingresos: contar(filas, (f) => f.hogar?.rango_ingresos_smlmv, Object.fromEntries(RANGOS_SMLMV.map((r) => [r.codigo, r.etiqueta])), [...RANGOS_SMLMV.map((r) => r.codigo), SIN]),
    por_hogar: contar(filas, (f) => { const p = f.hogar?.personas ?? 1; return p >= 5 ? "5+" : String(p); }, { "1": "1 persona", "2": "2 personas", "3": "3 personas", "4": "4 personas", "5+": "5 o más" }, ["1", "2", "3", "4", "5+"]),
    por_condicion: contar(filas, (f) => f.solicitante?.condiciones_especiales ?? [], CONDICIONES_ESPECIALES).filter((i) => i.clave !== SIN),
    por_genero: contar(filas, (f) => f.solicitante?.genero, GENEROS_SOLICITANTE),
    por_sisben: contar(filas, (f) => (f.solicitante?.sisben === true ? (f.solicitante.sisben_grupo ? `Grupo ${f.solicitante.sisben_grupo}` : "Sí, sin grupo") : siNo(f.solicitante?.sisben)), { no: "No afiliado" }),
    por_caja: contar(filas, (f) => siNo(f.solicitante?.caja_compensacion), SI_NO, ["si", "no", SIN]),
    recursos,
    top_faltantes: [...faltantes].map(([etiqueta, n]) => ({ clave: etiqueta, etiqueta, n })).sort((a, b) => b.n - a.n).slice(0, 8),
    por_validador: contar(filas.filter((f) => f.estado === "valido"), (f) => f.validado_por_nombre),
  };
}
export type MetricasPostulaciones = ReturnType<typeof agregarPostulaciones>;
