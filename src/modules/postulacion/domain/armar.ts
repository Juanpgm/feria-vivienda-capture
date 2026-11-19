// Form values -> stored postulación, with errors as flat `{ "seccion.campo": message }` (same shape the stepper uses).
import { derivarIngreso } from "@/modules/cierre-financiero/domain/smlmv";
import { calcularFaltantes } from "./faltantes";
import { documentosRepetidos, SECCIONES, totalIngresos, type Seccion } from "./schema";

export type Valores = Record<string, Record<string, unknown>>;
export type Errores = Record<string, string>;

/** Validates the given sections of `valores`; adds the cross-section check of repeated documents when `hogar` is among them. */
export function validarSecciones(valores: Valores, secciones: readonly Seccion[]): Errores {
  const errores: Errores = {};
  for (const s of secciones) {
    const r = SECCIONES[s].safeParse(valores[s] ?? {});
    if (!r.success) for (const i of r.error.issues) errores[[s, ...i.path].join(".")] ??= i.message;
  }
  if (secciones.includes("hogar")) {
    const integrantes = (valores.hogar?.integrantes ?? []) as { numero_documento?: unknown }[];
    for (const [k, m] of Object.entries(documentosRepetidos(String(valores.solicitante?.numero_documento ?? ""), integrantes))) errores[`hogar.${k}`] ??= m;
  }
  return errores;
}

/** The data part of a record (no consent/signature/photos): what is stored and what `faltantes` is computed on. */
export function armarDatos(valores: Valores) {
  const errores = validarSecciones(valores, ["solicitante", "hogar", "postulacion"]);
  if (Object.keys(errores).length) return { ok: false as const, errores };
  const solicitante = SECCIONES.solicitante.parse(valores.solicitante);
  const hogar = SECCIONES.hogar.parse(valores.hogar);
  const postulacion = SECCIONES.postulacion.parse(valores.postulacion);
  const total = totalIngresos(solicitante, hogar.integrantes);
  const ingreso = derivarIngreso(total);
  const datos = {
    solicitante,
    hogar: {
      integrantes: hogar.integrantes,
      personas: hogar.integrantes.length + 1,
      total_ingresos: total,
      ingreso_en_smlmv: ingreso.ingreso_en_smlmv,
      rango_ingresos_smlmv: ingreso.rango_ingresos_smlmv,
      valor_smlmv_aplicado: ingreso.valor_smlmv_aplicado,
    },
    postulacion,
  };
  return { ok: true as const, datos, faltantes: calcularFaltantes(datos) };
}
export type DatosPostulacion = Extract<ReturnType<typeof armarDatos>, { ok: true }>["datos"];
