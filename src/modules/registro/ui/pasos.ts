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
  /** Domain schema, loaded on demand to keep the first load lean. */
  schema: () => Promise<ZodType>;
};

export const PASOS: readonly Paso[] = [
  {
    id: "hogar",
    titulo: "Datos del hogar",
    seccion: "solicitante",
    campos: [
      "nombre_completo", "tipo_documento", "tipo_documento_otro", "codigo_pais_nacionalidad", "numero_documento",
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
];

/** Form strings -> schema input (radio "si"/"no" to boolean; ages only for the declared count). */
function aEntrada(paso: Paso, valores: Valores): Record<string, unknown> {
  const s: Record<string, unknown> = { ...valores[paso.seccion] };
  if (paso.seccion === "composicion") {
    const tiene = s.tiene_adulto_mayor === "si" ? true : s.tiene_adulto_mayor === "no" ? false : undefined;
    s.tiene_adulto_mayor = tiene;
    if (tiene) {
      const n = Number(s.cantidad_adultos_mayores);
      s.adultos_mayores = Array.isArray(s.adultos_mayores) && n >= 1 ? s.adultos_mayores.slice(0, n) : [];
    } else {
      s.cantidad_adultos_mayores = undefined;
      s.adultos_mayores = undefined;
    }
  }
  return { ...s, ...paso.relleno };
}

/** Flat `{ "seccion.campo": message }` for the step's own fields; empty when valid. */
export async function validarPaso(paso: Paso, valores: Valores): Promise<Record<string, string>> {
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
