// Step definitions and pure step logic (validation slice, state derivation). The UI maps `id` to a view
// in Stepper.tsx. To add a step: append an entry here and one view there.
import type { ZodType } from "zod";

export type Valores = Record<string, Record<string, unknown>>;
export type Marca = "completo" | "errores";
export type EstadoPaso = "pendiente" | "en_curso" | "completo" | "con_errores";

export type Paso = {
  id: string;
  titulo: string;
  /** Key of the aggregate record this step edits (e.g. "solicitante"). */
  seccion: string;
  /** Fields of that section owned by this step; only their issues are reported. */
  campos: readonly string[];
  /** Neutral valid values for section fields owned by OTHER steps, so cross-field rules still run. */
  relleno?: Record<string, unknown>;
  /** Domain schema, loaded on demand to keep the first load lean. Absent on steps that collect nothing (summary). */
  schema?: () => Promise<ZodType>;
};

export const PASOS: readonly Paso[] = [
  {
    id: "hogar",
    titulo: "Datos del hogar",
    seccion: "solicitante",
    campos: [
      "primer_nombre", "segundo_nombre", "primer_apellido", "segundo_apellido", "tipo_documento", "tipo_documento_otro", "codigo_pais_nacionalidad", "numero_documento",
      "fecha_expedicion_documento", "telefono_1", "telefono_2", "correo_solicitante", "anios_residencia",
      "fecha_nacimiento", "estado_civil",
    ],
    schema: () => import("@/modules/hogar/domain/schema").then((m) => m.hogarSchema),
  },
  {
    id: "composicion",
    titulo: "Composición familiar",
    seccion: "composicion",
    campos: ["cantidad_personas_hogar", "tiene_adulto_mayor", "cantidad_adultos_mayores", "adultos_mayores", "ingreso_hogar_cop"],
    relleno: { condiciones_especiales: ["ninguna"] },
    schema: () => import("@/modules/composicion/domain/schema").then((m) => m.composicionSchema),
  },
  {
    id: "proteccion",
    titulo: "Especial protección constitucional",
    seccion: "composicion",
    campos: ["condiciones_especiales"],
    relleno: { cantidad_personas_hogar: 1, tiene_adulto_mayor: false, ingreso_hogar_cop: 0 },
    schema: () => import("@/modules/composicion/domain/schema").then((m) => m.composicionSchema),
  },
  {
    id: "inmueble",
    titulo: "Inmueble y ubicación",
    seccion: "inmueble",
    campos: ["direccion", "codigo_division", "id_barrio_vereda", "estrato"],
    schema: () => import("@/modules/inmueble/domain/schema").then((m) => m.inmuebleSchema),
  },
  {
    id: "riesgo",
    titulo: "Riesgo y dictamen técnico",
    seccion: "riesgo",
    campos: ["esta_en_rud", "numero_rud", "rud_no_sabe", "dictamen", "dictamen_otro"],
    schema: () => import("@/modules/riesgo/domain/schema").then((m) => m.riesgoSchema),
  },
  {
    id: "titularidad",
    titulo: "Titularidad",
    seccion: "titularidad",
    campos: ["tipo_titularidad", "numero_matricula_inmobiliaria", "es_unica_propiedad", "excepcion_unica_propiedad"],
    schema: () => import("@/modules/titularidad/domain/schema").then((m) => m.titularidadSchema),
  },
  {
    id: "financiero",
    titulo: "Cierre financiero",
    seccion: "cierre_financiero",
    campos: ["fuentes_financiacion", "tiene_seguro", "codigo_aseguradora", "aseguradora_otra", "observaciones"],
    schema: () => import("@/modules/cierre-financiero/domain/schema").then((m) => m.cierreFinancieroSchema),
  },
  {
    id: "consentimiento",
    titulo: "Consentimiento",
    seccion: "consentimiento",
    campos: ["acepta_tratamiento", "acepta_datos_sensibles", "version"],
    schema: () => import("@/modules/consentimiento/domain/schema").then((m) => m.consentimientoSchema),
  },
  {
    id: "documentos",
    titulo: "Documento de identidad",
    seccion: "documentos",
    campos: ["documento_frente", "documento_reverso"],
    schema: () => import("@/modules/documentos/domain/schema").then((m) => m.documentosSchema),
  },
  { id: "resumen", titulo: "Resumen", seccion: "", campos: [] },
  {
    id: "firma",
    titulo: "Firma y envío",
    seccion: "firma",
    campos: ["metodo_firma", "imagen", "metodo_verificacion", "nota_verificacion"],
    schema: () => import("@/modules/firma/domain/schema").then((m) => m.firmaFormSchema),
  },
];

/** Radio "si"/"no" fields per section, converted to booleans before parsing. */
const BOOLEANOS: Record<string, string> = { composicion: "tiene_adulto_mayor", riesgo: "esta_en_rud", titularidad: "es_unica_propiedad", cierre_financiero: "tiene_seguro" };

/** Form strings of one section -> schema input (radio "si"/"no" to boolean; conditional fields only when they apply). */
export function entradaDeSeccion(seccion: string, valores: Valores): Record<string, unknown> {
  const s: Record<string, unknown> = { ...valores[seccion] };
  const campoBool = BOOLEANOS[seccion];
  if (campoBool) s[campoBool] = s[campoBool] === "si" ? true : s[campoBool] === "no" ? false : undefined;
  if (seccion === "composicion") {
    if (s.tiene_adulto_mayor) {
      const n = Number(s.cantidad_adultos_mayores);
      s.adultos_mayores = Array.isArray(s.adultos_mayores) && n >= 1 ? s.adultos_mayores.slice(0, n) : [];
    } else {
      s.cantidad_adultos_mayores = undefined;
      s.adultos_mayores = undefined;
    }
  }
  if (seccion === "titularidad" && s.es_unica_propiedad !== false) s.excepcion_unica_propiedad = undefined;
  if (seccion === "riesgo" && s.esta_en_rud !== true) {
    s.numero_rud = undefined;
    s.rud_no_sabe = undefined;
  }
  return s;
}

const aEntrada = (paso: Paso, valores: Valores) => ({ ...entradaDeSeccion(paso.seccion, valores), ...paso.relleno });

/** Flat `{ "seccion.campo": message }` for the step's own fields; empty when valid. */
export async function validarPaso(paso: Paso, valores: Valores): Promise<Record<string, string>> {
  if (!paso.schema) return {};
  const r = (await paso.schema()).safeParse(aEntrada(paso, valores));
  const errores: Record<string, string> = {};
  if (r.success) return errores;
  for (const i of r.error.issues) {
    if (!paso.campos.includes(String(i.path[0]))) continue;
    // A whole-array issue (e.g. missing ages) goes under `.root` so it can coexist with item errors.
    const ruta = i.path.length === 1 && i.path[0] === "adultos_mayores" ? [...i.path, "root"] : i.path;
    errores[[paso.seccion, ...ruta].join(".")] ??= i.message;
  }
  return errores;
}

export function estadoPaso(id: string, actual: string, marcas: Record<string, Marca>): EstadoPaso {
  if (id === actual) return "en_curso";
  return marcas[id] === "completo" ? "completo" : marcas[id] === "errores" ? "con_errores" : "pendiente";
}

export const ETIQUETA_ESTADO: Record<EstadoPaso, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completo: "Completo",
  con_errores: "Con errores",
};
