// Step definitions and pure step logic (validation slice, state derivation). The UI maps `id` to a view
// in Stepper.tsx. To add a step: append an entry here and one view there.
import type { ZodType } from "zod";

export type Valores = Record<string, Record<string, unknown>>;
export type Marca = "completo" | "errores";
export type EstadoPaso = "pendiente" | "en_curso" | "completo" | "con_errores";

/** One aggregate section validated by a step. A step may validate several (merged steps). */
export type Parte = {
  /** Key of the aggregate record this part edits (e.g. "solicitante"). */
  seccion: string;
  /** Fields of that section owned by the step; only their issues are reported. */
  campos: readonly string[];
  /** Domain schema, loaded on demand to keep the first load lean. */
  schema: () => Promise<ZodType>;
};

export type Paso = {
  id: string;
  titulo: string;
  /** Sections validated by this step; its fields are the union of their `campos`. */
  partes: readonly Parte[];
};

// Six steps for the fair: the per-domain screens are rendered in sequence under section headings (see Stepper.tsx),
// and each step validates the union of its sections, so no field and no rule was dropped by merging.
export const PASOS: readonly Paso[] = [
  {
    id: "solicitante",
    titulo: "Solicitante",
    partes: [
      {
        seccion: "solicitante",
        campos: [
          "primer_nombre", "segundo_nombre", "primer_apellido", "segundo_apellido", "tipo_documento", "tipo_documento_otro", "codigo_pais_nacionalidad", "numero_documento",
          "fecha_expedicion_documento", "telefono_1", "telefono_2", "correo_solicitante", "anios_residencia",
          "fecha_nacimiento", "estado_civil",
        ],
        schema: () => import("@/modules/hogar/domain/schema").then((m) => m.hogarSchema),
      },
    ],
  },
  {
    id: "hogar",
    titulo: "Hogar",
    partes: [
      {
        seccion: "composicion",
        campos: ["cantidad_personas_hogar", "tiene_adulto_mayor", "cantidad_adultos_mayores", "adultos_mayores", "ingreso_hogar_cop", "condiciones_especiales"],
        schema: () => import("@/modules/composicion/domain/schema").then((m) => m.composicionSchema),
      },
    ],
  },
  {
    id: "vivienda",
    titulo: "Vivienda",
    partes: [
      {
        seccion: "inmueble",
        campos: ["direccion", "codigo_division", "id_barrio_vereda", "estrato"],
        schema: () => import("@/modules/inmueble/domain/schema").then((m) => m.inmuebleSchema),
      },
      {
        seccion: "riesgo",
        campos: ["esta_en_rud", "numero_rud", "rud_no_sabe", "dictamen", "dictamen_otro"],
        schema: () => import("@/modules/riesgo/domain/schema").then((m) => m.riesgoSchema),
      },
      {
        seccion: "titularidad",
        campos: ["tipo_titularidad", "numero_matricula_inmobiliaria", "es_unica_propiedad", "excepcion_unica_propiedad"],
        schema: () => import("@/modules/titularidad/domain/schema").then((m) => m.titularidadSchema),
      },
    ],
  },
  {
    id: "financiero",
    titulo: "Cierre financiero",
    partes: [
      {
        seccion: "cierre_financiero",
        campos: ["fuentes_financiacion", "tiene_seguro", "codigo_aseguradora", "aseguradora_otra", "observaciones"],
        schema: () => import("@/modules/cierre-financiero/domain/schema").then((m) => m.cierreFinancieroSchema),
      },
    ],
  },
  {
    id: "autorizacion",
    titulo: "Autorización y documento",
    partes: [
      {
        seccion: "consentimiento",
        campos: ["acepta_tratamiento", "acepta_datos_sensibles", "version"],
        schema: () => import("@/modules/consentimiento/domain/schema").then((m) => m.consentimientoSchema),
      },
      {
        seccion: "documentos",
        campos: ["documento_frente", "documento_reverso"],
        schema: () => import("@/modules/documentos/domain/schema").then((m) => m.documentosSchema),
      },
    ],
  },
  {
    id: "revision",
    titulo: "Revisión y firma",
    partes: [
      {
        seccion: "firma",
        campos: ["metodo_firma", "imagen", "metodo_verificacion", "nota_verificacion"],
        schema: () => import("@/modules/firma/domain/schema").then((m) => m.firmaFormSchema),
      },
    ],
  },
];

/** Where a section lives: its step and the anchor (element id) of its heading inside that step. */
export const anclaDe = (clave: string) => `seccion-${clave}`;

/** Photos of the identity document can only be taken once the treatment of personal data is authorized. */
export const fotosHabilitadas = (valores: Valores): boolean => valores.consentimiento?.acepta_tratamiento === true;

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

/** Flat `{ "seccion.campo": message }` for the step's own fields (union of its sections); empty when valid. */
export async function validarPaso(paso: Paso, valores: Valores): Promise<Record<string, string>> {
  const errores: Record<string, string> = {};
  for (const parte of paso.partes) {
    const r = (await parte.schema()).safeParse(entradaDeSeccion(parte.seccion, valores));
    if (r.success) continue;
    for (const i of r.error.issues) {
      if (!parte.campos.includes(String(i.path[0]))) continue;
      // A whole-array issue (e.g. missing ages) goes under `.root` so it can coexist with item errors.
      const ruta = i.path.length === 1 && i.path[0] === "adultos_mayores" ? [...i.path, "root"] : i.path;
      errores[[parte.seccion, ...ruta].join(".")] ??= i.message;
    }
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
