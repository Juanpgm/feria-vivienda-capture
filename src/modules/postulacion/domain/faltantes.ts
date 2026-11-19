// What a stored postulación still lacks before an official can validate it (S8/S11/S13).
// Creation only needs the essentials (schema.ts); validation needs everything listed here. One function, used by the
// summary on screen, by the server on every save (stored as `faltantes`) and by the validation guard.
import { FUENTES_RECURSOS, MODALIDAD_DEUDORES, MODALIDADES_CON_CIERRE, MODALIDADES_CON_PROYECTO, type FuenteRecurso, type Modalidad } from "./catalogos";

export type Faltante = { ruta: string; etiqueta: string };

type Registro = {
  solicitante: Record<string, unknown>;
  hogar: { integrantes: readonly Record<string, unknown>[] };
  postulacion: {
    modalidad: Modalidad;
    obligacion: Record<string, unknown> | null;
    proyecto: Record<string, unknown> | null;
    fuentes: readonly string[];
    recursos: Partial<Record<string, { valor: number | null } | undefined>>;
  };
};

const SOLICITANTE: Record<string, string> = {
  lugar_expedicion: "Lugar de expedición del documento",
  fecha_expedicion: "Fecha de expedición del documento",
  lugar_nacimiento: "Lugar de nacimiento",
  ingreso_mensual: "Ingreso mensual del solicitante",
  genero: "Género",
  ocupacion: "Ocupación",
  direccion: "Dirección de domicilio",
  codigo_division: "Comuna o corregimiento",
  id_barrio_vereda: "Barrio o vereda",
  estrato: "Estrato",
  anios_residencia: "Tiempo de residencia en Cali",
  notificacion_electronica: "Autorización de notificación electrónica",
  caja_compensacion: "Afiliación a caja de compensación",
  sisben: "Afiliación al Sisbén",
};
const INTEGRANTE: Record<string, string> = {
  fecha_nacimiento: "fecha de nacimiento",
  tipo_documento: "tipo de documento",
  numero_documento: "número de documento",
  parentesco: "parentesco",
  ingresos: "ingresos mensuales (0 si no tiene)",
};
const OBLIGACION: Record<string, string> = {
  entidad_acreedora: "Entidad acreedora",
  numero_obligacion: "Número de obligación o crédito",
  saldo_adeudado: "Saldo total adeudado",
  estado: "Estado de la obligación",
};
const PROYECTO: Record<string, string> = { nombre: "Nombre del proyecto de vivienda", constructora: "Nombre de la constructora" };

const falta = (v: unknown) => v === null || v === undefined || v === "";

export function calcularFaltantes(r: Registro): Faltante[] {
  const out: Faltante[] = [];
  const s = r.solicitante;
  for (const [k, etiqueta] of Object.entries(SOLICITANTE)) if (falta(s[k])) out.push({ ruta: `solicitante.${k}`, etiqueta });
  if (s.lugar_nacimiento === "exterior" && falta(s.lugar_nacimiento_otro)) out.push({ ruta: "solicitante.lugar_nacimiento_otro", etiqueta: "País o ciudad de nacimiento" });
  if (s.genero === "otro" && falta(s.genero_otro)) out.push({ ruta: "solicitante.genero_otro", etiqueta: "Cuál género" });
  if (s.caja_compensacion === true && falta(s.caja_cual)) out.push({ ruta: "solicitante.caja_cual", etiqueta: "Cuál caja de compensación" });
  if (s.sisben === true && (falta(s.sisben_grupo) || falta(s.sisben_subgrupo))) out.push({ ruta: "solicitante.sisben_grupo", etiqueta: "Grupo y subgrupo del Sisbén" });

  r.hogar.integrantes.forEach((m, i) => {
    const quien = `Integrante ${i + 1}`;
    for (const [k, etiqueta] of Object.entries(INTEGRANTE)) if (falta(m[k])) out.push({ ruta: `hogar.integrantes.${i}.${k}`, etiqueta: `${quien}: ${etiqueta}` });
  });

  const p = r.postulacion;
  if (p.modalidad === MODALIDAD_DEUDORES) {
    const o = p.obligacion ?? {};
    for (const [k, etiqueta] of Object.entries(OBLIGACION)) if (falta(o[k])) out.push({ ruta: `postulacion.${k === "estado" ? "estado_obligacion" : k}`, etiqueta });
    if (o.autoriza_giro !== true) out.push({ ruta: "postulacion.autoriza_giro", etiqueta: "Autorización de giro al acreedor" });
  }
  if (MODALIDADES_CON_PROYECTO.includes(p.modalidad)) {
    const pr = p.proyecto ?? {};
    for (const [k, etiqueta] of Object.entries(PROYECTO)) if (falta(pr[k])) out.push({ ruta: `postulacion.${k === "nombre" ? "proyecto_nombre" : k}`, etiqueta });
    if (falta(pr.valor_vis) && falta(pr.valor_vip)) out.push({ ruta: "postulacion.valor_vis", etiqueta: "Valor de la solución de vivienda (VIS o VIP)" });
  }
  for (const f of p.fuentes) if (falta(p.recursos[f]?.valor)) out.push({ ruta: `postulacion.recursos.${f}.valor`, etiqueta: `Valor de: ${FUENTES_RECURSOS[f as FuenteRecurso]?.etiqueta ?? f}` });
  if (MODALIDADES_CON_CIERRE.includes(p.modalidad) && !p.fuentes.some((f) => (p.recursos[f]?.valor ?? 0) > 0))
    out.push({ ruta: "postulacion.fuentes", etiqueta: "Al menos una fuente de recursos con valor (cierre financiero)" });
  return out;
}
