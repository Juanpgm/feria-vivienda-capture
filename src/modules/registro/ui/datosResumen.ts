// Pure logic of the review step: validates every section of the form and turns the parsed (normalized and
// derived) data into label/value rows. Kept free of React so it can be unit tested.
import type { ZodType } from "zod";
import type { CierreFinanciero } from "@/modules/cierre-financiero/domain/schema";
import { formatoCop, RANGOS_SMLMV } from "@/modules/cierre-financiero/domain/smlmv";
import { calcularEdad } from "@/modules/composicion/domain/derivaciones";
import type { Composicion } from "@/modules/composicion/domain/schema";
import type { Hogar } from "@/modules/hogar/domain/schema";
import type { Inmueble } from "@/modules/inmueble/domain/schema";
import type { Riesgo } from "@/modules/riesgo/domain/schema";
import type { Titularidad } from "@/modules/titularidad/domain/schema";
import {
  BANDAS_ADULTO_MAYOR, BANDAS_HOGAR, CONDICIONES_ESPECIALES, DICTAMENES, ESTADOS_CIVILES, FUENTES_FINANCIACION,
  TIPOS_DOCUMENTO, TITULARIDADES,
} from "@/shared/constantes";
import aseguradoras from "@/modules/cierre-financiero/catalogo/aseguradoras.json";
import { entradaDeSeccion, type Valores } from "./pasos";

export type Fila = { etiqueta: string; valor: string };
export type Evaluacion<T> = { ok: true; datos: T } | { ok: false; errores: { campo: string; mensaje: string }[] };

type Seccion = {
  id: string;
  titulo: string;
  /** Step that edits this section (target of the "Editar" link). */
  paso: string;
  schema: () => Promise<ZodType>;
};

export const SECCIONES: readonly Seccion[] = [
  { id: "solicitante", titulo: "Datos del hogar", paso: "hogar", schema: () => import("@/modules/hogar/domain/schema").then((m) => m.hogarSchema) },
  { id: "composicion", titulo: "Composición familiar", paso: "composicion", schema: () => import("@/modules/composicion/domain/schema").then((m) => m.composicionSchema) },
  { id: "inmueble", titulo: "Inmueble y ubicación", paso: "inmueble", schema: () => import("@/modules/inmueble/domain/schema").then((m) => m.inmuebleSchema) },
  { id: "riesgo", titulo: "Riesgo y dictamen técnico", paso: "riesgo", schema: () => import("@/modules/riesgo/domain/schema").then((m) => m.riesgoSchema) },
  { id: "titularidad", titulo: "Titularidad", paso: "titularidad", schema: () => import("@/modules/titularidad/domain/schema").then((m) => m.titularidadSchema) },
  { id: "cierre_financiero", titulo: "Cierre financiero", paso: "financiero", schema: () => import("@/modules/cierre-financiero/domain/schema").then((m) => m.cierreFinancieroSchema) },
];

/** Requirements of the next phase (photos, consent, signature). Phase 3 replaces these with real sections. */
export const PENDIENTES_FASE_3 = [
  "Fotos del documento de identidad (frente y reverso)",
  "Autorización de tratamiento de datos personales",
  "Firma del solicitante",
] as const;

/** Field labels, only used to name the field of a validation message. */
const ETIQUETAS: Record<string, string> = {
  nombre_completo: "Nombre completo", tipo_documento: "Tipo de documento", tipo_documento_otro: "Cuál documento",
  codigo_pais_nacionalidad: "Nacionalidad", numero_documento: "Número de documento", fecha_expedicion_documento: "Fecha de expedición",
  telefono_1: "Teléfono principal", telefono_2: "Teléfono alterno", correo_solicitante: "Correo electrónico",
  anios_residencia: "Años de residencia", fecha_nacimiento: "Fecha de nacimiento", estado_civil: "Estado civil",
  cantidad_personas_hogar: "Personas en el hogar", tiene_adulto_mayor: "Adultos mayores", cantidad_adultos_mayores: "Cantidad de adultos mayores",
  adultos_mayores: "Edades de adultos mayores", condiciones_especiales: "Especial protección", ingreso_hogar_cop: "Ingreso mensual",
  direccion: "Dirección", codigo_division: "Comuna o corregimiento", id_barrio_vereda: "Barrio o vereda", barrio_vereda_otro: "Barrio o vereda",
  estrato: "Estrato", esta_en_rud: "RUD", numero_rud: "Número de RUD", dictamen: "Dictamen técnico", dictamen_otro: "Cuál dictamen",
  tipo_titularidad: "Titularidad", numero_matricula_inmobiliaria: "Matrícula inmobiliaria", fuentes_financiacion: "Fuentes de financiación",
  tiene_seguro: "Seguro", codigo_aseguradora: "Aseguradora", aseguradora_otra: "Nombre de la aseguradora",
};

export async function evaluarSeccion(s: Seccion, valores: Valores): Promise<Evaluacion<unknown>> {
  const r = (await s.schema()).safeParse(entradaDeSeccion(s.id, valores));
  if (r.success) return { ok: true, datos: r.data };
  const vistos = new Set<string>();
  const errores: { campo: string; mensaje: string }[] = [];
  for (const i of r.error.issues) {
    const clave = String(i.path[0]);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    errores.push({ campo: ETIQUETAS[clave] ?? clave, mensaje: i.message });
  }
  return { ok: false, errores };
}

export async function evaluarRegistro(valores: Valores): Promise<Record<string, Evaluacion<unknown>>> {
  const out = await Promise.all(SECCIONES.map((s) => evaluarSeccion(s, valores)));
  return Object.fromEntries(SECCIONES.map((s, i) => [s.id, out[i]]));
}

/** `2026-03-05` -> `05/03/2026` (string split: no timezone involved). */
export const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

const lista = (codigos: readonly string[], etiquetas: Record<string, string>) => codigos.map((c) => etiquetas[c] ?? c).join("; ");
const siNo = (b: boolean) => (b ? "Sí" : "No");

export function filasDe(id: string, datos: unknown, hoy: string): Fila[] {
  switch (id) {
    case "solicitante": {
      const h = datos as Hogar;
      const doc = h.tipo_documento === "otro" ? (h.tipo_documento_otro ?? "Otro") : TIPOS_DOCUMENTO[h.tipo_documento];
      return [
        { etiqueta: "Nombre", valor: h.nombre_completo },
        { etiqueta: "Documento", valor: `${doc} ${h.numero_documento}` },
        { etiqueta: "Nacionalidad", valor: h.nacionalidad },
        { etiqueta: "Fecha de expedición", valor: fechaCorta(h.fecha_expedicion_documento) },
        { etiqueta: "Teléfono principal", valor: h.telefono_1 },
        ...(h.telefono_2 ? [{ etiqueta: "Teléfono alterno", valor: h.telefono_2 }] : []),
        { etiqueta: "Correo", valor: h.correo_solicitante },
        { etiqueta: "Fecha de nacimiento", valor: `${fechaCorta(h.fecha_nacimiento)} (${calcularEdad(h.fecha_nacimiento, hoy)} años)` },
        { etiqueta: "Estado civil", valor: ESTADOS_CIVILES[h.estado_civil] },
        { etiqueta: "Años de residencia", valor: String(h.anios_residencia) },
      ];
    }
    case "composicion": {
      const c = datos as Composicion;
      const rango = RANGOS_SMLMV.find((r) => r.codigo === c.rango_ingresos_smlmv)?.etiqueta ?? c.rango_ingresos_smlmv;
      return [
        { etiqueta: "Personas en el hogar", valor: `${c.cantidad_personas_hogar} (${BANDAS_HOGAR[c.rango_tamano_hogar]})` },
        {
          etiqueta: "Adultos mayores",
          valor: c.tiene_adulto_mayor
            ? `${c.adultos_mayores.map((a) => `${a.edad} años`).join(", ")} (${BANDAS_ADULTO_MAYOR[c.rango_adulto_mayor]})`
            : `No hay (${BANDAS_ADULTO_MAYOR.ninguno})`,
        },
        { etiqueta: "Especial protección", valor: lista(c.condiciones_especiales, CONDICIONES_ESPECIALES) },
        { etiqueta: "Ingreso mensual", valor: `${formatoCop(c.ingreso_hogar_cop)} (${rango})` },
        { etiqueta: "Equivale a", valor: `${String(c.ingreso_en_smlmv).replace(".", ",")} SMLMV (SMLMV ${c.anio_smlmv}: ${formatoCop(c.valor_smlmv_aplicado)})` },
      ];
    }
    case "inmueble": {
      const i = datos as Inmueble;
      const lugar = i.nombre_barrio_vereda ?? `${i.barrio_vereda_otro} (escrito a mano)`;
      return [
        { etiqueta: "Dirección", valor: i.es_direccion_norm_completa ? `${i.direccion} (${i.direccion_norm})` : i.direccion },
        { etiqueta: i.tipo_division === "comuna" ? "Comuna" : "Corregimiento", valor: i.nombre_division },
        { etiqueta: i.sector === "rural" ? "Vereda" : "Barrio", valor: lugar },
        { etiqueta: "Sector", valor: i.sector === "rural" ? "Rural" : "Urbano" },
        { etiqueta: "Estrato", valor: String(i.estrato) },
      ];
    }
    case "riesgo": {
      const r = datos as Riesgo;
      return [
        { etiqueta: "Registrado en el RUD", valor: r.esta_en_rud ? (r.numero_rud ? `Sí, número ${r.numero_rud}` : "Sí, no sabe el número") : "No" },
        { etiqueta: "Dictamen técnico", valor: r.dictamen === "otro" ? `Otro: ${r.dictamen_otro}` : DICTAMENES[r.dictamen] },
      ];
    }
    case "titularidad": {
      const t = datos as Titularidad;
      return [
        { etiqueta: "Titularidad", valor: TITULARIDADES[t.tipo_titularidad] },
        { etiqueta: "Matrícula inmobiliaria", valor: t.numero_matricula_inmobiliaria ?? "No registrada" },
      ];
    }
    case "cierre_financiero": {
      const f = datos as CierreFinanciero;
      const aseg = f.aseguradora_otra ?? aseguradoras.items.find((a) => a.codigo === f.codigo_aseguradora)?.nombre ?? "";
      return [
        { etiqueta: "Fuentes de financiación", valor: lista(f.fuentes_financiacion, FUENTES_FINANCIACION) },
        { etiqueta: "Seguro", valor: f.tiene_seguro ? `${siNo(true)}, ${aseg}` : siNo(false) },
      ];
    }
    default:
      return [];
  }
}
