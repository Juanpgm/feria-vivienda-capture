// Pure aggregation for the dashboard: minimal registro projections in, counts out. No PII leaves this module:
// the only personal data in the output is the funcionario name/email (staff, admin scope only).
import { RANGOS_SMLMV } from "@/modules/cierre-financiero/domain/smlmv";
import {
  BANDAS_ADULTO_MAYOR,
  BANDAS_HOGAR,
  DICTAMENES,
  ESTADOS_REVISION,
  TITULARIDADES,
} from "@/shared/constantes";
import { fechaBogota } from "@/shared/tiempo";

/** Fields read from each registro (flattened from the Firestore projection). Everything may be missing in old records. */
export type RegistroMinimo = {
  registrado_en?: string | null; // ISO instant
  fecha_registro_bogota?: string | null; // 'YYYY-MM-DD' (authoritative when present)
  estado?: string | null;
  estado_revision?: string | null;
  registrado_por_uid?: string | null;
  registrado_por_nombre?: string | null;
  registrado_por_correo?: string | null;
  comuna?: string | null;
  barrio?: string | null;
  sector?: string | null;
  estrato?: number | null;
  rango_ingresos?: string | null;
  rango_hogar?: string | null;
  rango_adulto_mayor?: string | null;
  titularidad?: string | null;
  dictamen?: string | null;
  en_rud?: boolean | null;
  rud_no_sabe?: boolean | null;
  tiene_seguro?: boolean | null;
};

export type Alcance = "completo" | "usuario" | "lectura";
export type Item = { clave: string; etiqueta: string; n: number; detalle?: string };
export type Resumen = { total: number; hoy: number; ultimos_7: number; ultimos_30: number };
export type FilaFuncionario = { uid: string; nombre: string; correo: string; n: number; ultimo_registro: string | null };

export type DashboardCompleto = {
  alcance: "completo";
  generado_en: string;
  filtros: { desde: string | null; hasta: string | null; funcionario: string | null };
  resumen: Resumen;
  serie_diaria: { fecha: string; n: number }[];
  por_funcionario: FilaFuncionario[];
  por_revision: Item[];
  por_comuna: Item[];
  por_barrio: Item[];
  por_sector: Item[];
  por_estrato: Item[];
  por_ingresos: Item[];
  por_hogar: Item[];
  por_adulto_mayor: Item[];
  por_titularidad: Item[];
  por_dictamen: Item[];
  por_rud: Item[];
  por_seguro: Item[];
};
export type DashboardUsuario = { alcance: "usuario"; generado_en: string; resumen: Resumen; propios: Resumen };
export type DashboardLectura = { alcance: "lectura"; generado_en: string; resumen: Resumen };
export type Dashboard = DashboardCompleto | DashboardUsuario | DashboardLectura;

export type OpcionesAgregacion = {
  alcance: Alcance;
  uid?: string; // viewer; needed for "usuario"
  desde?: string | null;
  hasta?: string | null;
  funcionario?: string | null;
  hoy?: string; // 'YYYY-MM-DD' in Bogota (injectable for tests)
  generadoEn?: string;
  topBarrios?: number;
};

export const MAX_DIAS_SERIE = 90;
export const DIAS_SERIE_DEFECTO = 30;
const SIN_DATO = "sin_dato";

const MS_DIA = 86_400_000;
const aMs = (f: string) => Date.parse(`${f}T00:00:00Z`);
export const sumarDias = (f: string, n: number) => new Date(aMs(f) + n * MS_DIA).toISOString().slice(0, 10);

/** Bogota calendar day of a record: the stored string, else derived from the server timestamp. */
export function diaDe(r: RegistroMinimo): string | null {
  if (r.fecha_registro_bogota) return r.fecha_registro_bogota;
  if (!r.registrado_en) return null;
  const t = new Date(r.registrado_en);
  return Number.isNaN(t.getTime()) ? null : fechaBogota(t);
}

function resumir(dias: (string | null)[], hoy: string): Resumen {
  const desde7 = sumarDias(hoy, -6);
  const desde30 = sumarDias(hoy, -29);
  const r: Resumen = { total: dias.length, hoy: 0, ultimos_7: 0, ultimos_30: 0 };
  for (const d of dias) {
    if (!d || d > hoy) continue; // future dates (clock skew) only count in the total
    if (d === hoy) r.hoy++;
    if (d >= desde7) r.ultimos_7++;
    if (d >= desde30) r.ultimos_30++;
  }
  return r;
}

/** Counts `clave(r)` over `registros`, in the fixed order of `etiquetas` (zero-filled); unknown keys go to "Sin dato" (only if > 0). */
function distribuir(registros: RegistroMinimo[], clave: (r: RegistroMinimo) => string | null, etiquetas: Record<string, string>): Item[] {
  const cuenta = new Map<string, number>();
  for (const r of registros) {
    const k = clave(r);
    const key = k !== null && k in etiquetas ? k : SIN_DATO;
    cuenta.set(key, (cuenta.get(key) ?? 0) + 1);
  }
  const items = Object.entries(etiquetas).map(([k, etiqueta]) => ({ clave: k, etiqueta, n: cuenta.get(k) ?? 0 }));
  const sin = cuenta.get(SIN_DATO) ?? 0;
  return sin > 0 ? [...items, { clave: SIN_DATO, etiqueta: "Sin dato", n: sin }] : items;
}

/** Open-ended labels (comuna, barrio): descending by count, then name. Top `max` plus an aggregated "Otros". */
function ranking(
  registros: RegistroMinimo[],
  clave: (r: RegistroMinimo) => { k: string; etiqueta: string; detalle?: string } | null,
  max = Infinity,
): Item[] {
  const m = new Map<string, Item>();
  for (const r of registros) {
    const c = clave(r) ?? { k: SIN_DATO, etiqueta: "Sin dato" };
    const it = m.get(c.k) ?? { clave: c.k, etiqueta: c.etiqueta, n: 0, ...(c.detalle ? { detalle: c.detalle } : {}) };
    it.n++;
    m.set(c.k, it);
  }
  const todos = [...m.values()].sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta, "es"));
  if (todos.length <= max) return todos;
  const resto = todos.slice(max);
  return [...todos.slice(0, max), { clave: "otros", etiqueta: "Otros", n: resto.reduce((s, i) => s + i.n, 0), detalle: `${resto.length} más` }];
}

const texto = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const siNo = (v: boolean | null | undefined) => (v === true ? "si" : v === false ? "no" : null);

function serie(dias: (string | null)[], hoy: string, desde: string | null, hasta: string | null) {
  const fin = hasta ?? hoy;
  let inicio = desde ?? sumarDias(fin, -(DIAS_SERIE_DEFECTO - 1));
  if (aMs(fin) - aMs(inicio) > (MAX_DIAS_SERIE - 1) * MS_DIA) inicio = sumarDias(fin, -(MAX_DIAS_SERIE - 1));
  if (inicio > fin) inicio = fin;
  const cuenta = new Map<string, number>();
  for (const d of dias) if (d) cuenta.set(d, (cuenta.get(d) ?? 0) + 1);
  const out: { fecha: string; n: number }[] = [];
  for (let f = inicio; f <= fin; f = sumarDias(f, 1)) out.push({ fecha: f, n: cuenta.get(f) ?? 0 });
  return out;
}

function porFuncionario(registros: RegistroMinimo[]): FilaFuncionario[] {
  const m = new Map<string, FilaFuncionario>();
  for (const r of registros) {
    const uid = r.registrado_por_uid ?? SIN_DATO;
    const f = m.get(uid) ?? { uid, nombre: texto(r.registrado_por_nombre) ?? "Sin nombre", correo: r.registrado_por_correo ?? "", n: 0, ultimo_registro: null };
    f.n++;
    const d = diaDe(r);
    if (d && (!f.ultimo_registro || d > f.ultimo_registro)) f.ultimo_registro = d;
    m.set(uid, f);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Builds the role-scoped output. The shape itself enforces the scope: "lectura" (unapproved Google session) and
 * "usuario" never receive breakdowns or other funcionarios' data, only counts.
 * ponytail: read-and-reduce over a field projection is fine for low thousands of registros; the upgrade path is
 * transactional counters written in the create batch (design: contadores/*).
 */
export function agregar(todos: RegistroMinimo[], o: OpcionesAgregacion): Dashboard {
  const hoy = o.hoy ?? fechaBogota();
  const generado_en = o.generadoEn ?? new Date().toISOString();
  const vigentes = todos.filter((r) => r.estado !== "anulado"); // annulled registros do not count

  if (o.alcance !== "completo") {
    const resumen = resumir(vigentes.map(diaDe), hoy);
    if (o.alcance === "lectura") return { alcance: "lectura", generado_en, resumen };
    const propios = o.uid ? vigentes.filter((r) => r.registrado_por_uid === o.uid) : [];
    return { alcance: "usuario", generado_en, resumen, propios: resumir(propios.map(diaDe), hoy) };
  }

  const desde = o.desde || null;
  const hasta = o.hasta || null;
  const funcionario = o.funcionario || null;
  const enRango = vigentes.filter((r) => {
    const d = diaDe(r);
    return !((desde || hasta) && !d) && !(desde && d! < desde) && !(hasta && d! > hasta);
  });
  // The funcionario table always lists everybody in the range, so the filter options never collapse to one entry.
  const rs = funcionario ? enRango.filter((r) => r.registrado_por_uid === funcionario) : enRango;
  const dias = rs.map(diaDe);

  return {
    alcance: "completo",
    generado_en,
    filtros: { desde, hasta, funcionario },
    resumen: resumir(dias, hoy),
    serie_diaria: serie(dias, hoy, desde, hasta),
    por_funcionario: porFuncionario(enRango),
    por_revision: distribuir(rs, (r) => r.estado_revision ?? null, ESTADOS_REVISION),
    por_comuna: ranking(rs, (r) => {
      const c = texto(r.comuna);
      return c ? { k: c, etiqueta: c } : null;
    }),
    por_barrio: ranking(
      rs,
      (r) => {
        const b = texto(r.barrio);
        return b ? { k: `${r.comuna ?? ""}|${b}`, etiqueta: b, detalle: texto(r.comuna) ?? undefined } : null;
      },
      o.topBarrios ?? 15,
    ),
    por_sector: distribuir(rs, (r) => r.sector ?? null, { urbano: "Urbano", rural: "Rural" }),
    por_estrato: distribuir(rs, (r) => (r.estrato ? String(r.estrato) : null), { "1": "Estrato 1", "2": "Estrato 2", "3": "Estrato 3", "4": "Estrato 4", "5": "Estrato 5", "6": "Estrato 6" }),
    por_ingresos: distribuir(rs, (r) => r.rango_ingresos ?? null, Object.fromEntries(RANGOS_SMLMV.map((x) => [x.codigo, x.etiqueta]))),
    por_hogar: distribuir(rs, (r) => r.rango_hogar ?? null, BANDAS_HOGAR),
    por_adulto_mayor: distribuir(rs, (r) => r.rango_adulto_mayor ?? null, BANDAS_ADULTO_MAYOR),
    por_titularidad: distribuir(rs, (r) => r.titularidad ?? null, TITULARIDADES),
    por_dictamen: distribuir(rs, (r) => r.dictamen ?? null, DICTAMENES),
    por_rud: distribuir(rs, (r) => (r.en_rud === true ? (r.rud_no_sabe ? "no_sabe" : "si") : siNo(r.en_rud)), { si: "Sí, con número de RUD", no_sabe: "Sí, no sabe el número", no: "No está en el RUD" }),
    por_seguro: distribuir(rs, (r) => siNo(r.tiene_seguro), { si: "Tiene seguro", no: "No tiene seguro" }),
  };
}
