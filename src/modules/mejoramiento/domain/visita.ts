// Zod schema of a field visit (client step validation AND server re-validation) and the server-side budget
// builder. The client sends ITEM codes and quantity expressions only; descriptions, units and prices always come
// from the APUS catalogue on the server.
import { z } from "zod";
import { normalizarDireccion } from "@/shared/normalizacion/direccion";
import { normalizarDocumento, normalizarNombre } from "@/shared/normalizacion/texto";
import { enumDe, entero, telefono, textoOpcional } from "@/shared/validacion";
import type { Apu } from "./apus";
import { evaluarCantidad } from "./cantidad";
import { ALCANCES, APLICA_PARA, ESTADOS, NO_APLICA_POR, RELACIONES_ATIENDE, SECCIONES, SI_NO, TIPOS_DOCUMENTO, type Pregunta } from "./catalogos";
import { costoDirecto } from "./costos";

export const OBSERVACIONES_MAX = 5000;
export const MAX_CAPITULOS = 30;
export const MAX_FILAS_CAPITULO = 100;

const nombre = z
  .string({ error: "Ingrese el nombre completo" })
  .transform(normalizarNombre)
  .pipe(z.string().min(5, "Ingrese el nombre completo").max(120));
const documento = z
  .string({ error: "Ingrese el número de documento" })
  .transform(normalizarDocumento)
  .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, "Número de documento inválido"));
const id = z.string().regex(/^[A-Za-z0-9-]{1,40}$/, "Identificador inválido");

export const atiendeSchema = z
  .object({
    relacion: enumDe(RELACIONES_ATIENDE),
    relacion_otro: textoOpcional,
    nombre,
    documento,
    parentesco: textoOpcional,
  })
  .superRefine((v, ctx) => {
    if (v.relacion === "otro" && !v.relacion_otro) ctx.addIssue({ code: "custom", path: ["relacion_otro"], message: "Indique cuál" });
    if (v.relacion !== "propietario" && !v.parentesco)
      ctx.addIssue({ code: "custom", path: ["parentesco"], message: "Indique el parentesco con el propietario" });
  })
  .transform((v) => ({ ...v, relacion_otro: v.relacion === "otro" ? v.relacion_otro : null, parentesco: v.relacion === "propietario" ? null : v.parentesco }));

export const propietarioSchema = z.object({
  nombre,
  tipo_documento: enumDe(TIPOS_DOCUMENTO),
  documento,
  telefono,
  correo: z
    .string()
    .nullish()
    .transform((s) => s?.trim().toLowerCase() || null)
    .pipe(z.email("Correo inválido").nullable()),
  direccion: z
    .string({ error: "Ingrese la dirección del predio" })
    .transform((s) => normalizarDireccion(s).norm)
    .pipe(z.string().min(5, "Ingrese la dirección del predio").max(200)),
  anios_habitando: entero().pipe(z.number().min(0, "Valor inválido").max(120, "Valor inválido")),
  personas: entero().pipe(z.number().min(1, "Debe habitar al menos una persona").max(50, "Valor inválido")),
});

const respuesta = (p: Pregunta) => {
  switch (p.tipo) {
    case "si_no":
      return enumDe(SI_NO);
    case "estado":
      return enumDe(ESTADOS);
    case "opcion":
      return enumDe(p.opciones);
    case "numero":
      return entero().pipe(z.number().min(0).max(100));
    case "texto":
      return z.string().trim().max(200);
  }
};

/** One optional object per format block; unknown keys and values are rejected. */
const seccionesSchema = z
  .object(
    Object.fromEntries(
      SECCIONES.map((s) => [s.clave, z.object(Object.fromEntries(s.preguntas.map((p) => [p.clave, respuesta(p).nullish()]))).strict().optional()]),
    ),
  )
  .strict();

export const diagnosticoSchema = z
  .object({
    aplica: enumDe(SI_NO),
    aplica_para: z.array(enumDe(APLICA_PARA)).default([]),
    no_aplica_por: enumDe(NO_APLICA_POR).nullish(),
    alcance: enumDe(ALCANCES).nullish(),
    secciones: seccionesSchema.default({}),
  })
  .superRefine((v, ctx) => {
    if (v.aplica === "si") {
      if (!v.aplica_para.length) ctx.addIssue({ code: "custom", path: ["aplica_para"], message: "Seleccione para qué aplica el mejoramiento" });
      if (!v.alcance) ctx.addIssue({ code: "custom", path: ["alcance"], message: "Seleccione el alcance del mejoramiento" });
    } else if (!v.no_aplica_por) ctx.addIssue({ code: "custom", path: ["no_aplica_por"], message: "Seleccione por qué no aplica" });
  })
  .transform((v) =>
    v.aplica === "si"
      ? { ...v, aplica_para: [...new Set(v.aplica_para)], no_aplica_por: null }
      : { ...v, aplica_para: [], alcance: null },
  );

const filaSchema = z.object({
  id,
  item: z.string().trim().min(1, "Seleccione la actividad").max(40),
  cantidad_expr: z
    .string({ error: "Ingrese la cantidad medida" })
    .trim()
    .max(200)
    .superRefine((s, ctx) => {
      const r = evaluarCantidad(s);
      if (!r.ok) ctx.addIssue({ code: "custom", message: r.error });
    }),
});

const capituloSchema = z.object({
  id,
  nombre: z.string().trim().min(1, "Ingrese el nombre del capítulo").max(80),
  filas: z.array(filaSchema).max(MAX_FILAS_CAPITULO, `Máximo ${MAX_FILAS_CAPITULO} actividades por capítulo`),
});

export const visitaSchema = z
  .object({
    /** Client-generated UUID: makes the submit idempotent. */
    id: z.uuid("Identificador de visita inválido"),
    atiende: atiendeSchema,
    propietario: propietarioSchema,
    diagnostico: diagnosticoSchema,
    capitulos: z.array(capituloSchema).max(MAX_CAPITULOS, `Máximo ${MAX_CAPITULOS} capítulos`),
    observaciones: z.string().trim().max(OBSERVACIONES_MAX, `Máximo ${OBSERVACIONES_MAX} caracteres`).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.diagnostico.aplica === "si" && !v.capitulos.some((c) => c.filas.length))
      ctx.addIssue({ code: "custom", path: ["capitulos"], message: "Agregue al menos una actividad con su cantidad medida" });
  })
  .transform((v) => (v.diagnostico.aplica === "si" ? v : { ...v, capitulos: [] }));

export type VisitaEntrada = z.input<typeof visitaSchema>;
export type Visita = z.output<typeof visitaSchema>;

export type FilaPresupuesto = {
  id: string;
  item: string;
  descripcion: string;
  und: string;
  costo_unitario: number;
  cantidad_expr: string;
  cantidad: number;
  costo_directo: number;
};

/** Rows priced from the catalogue; `desconocidos` lists ITEMs not in APUS (the submit must be rejected). */
export function armarPresupuesto(capitulos: Visita["capitulos"], apus: Map<string, Apu>) {
  const desconocidos: string[] = [];
  const armados = capitulos.map((c) => {
    const filas: FilaPresupuesto[] = c.filas.flatMap((f) => {
      const apu = apus.get(f.item);
      const r = evaluarCantidad(f.cantidad_expr);
      if (!apu || !r.ok) {
        if (!apu) desconocidos.push(f.item);
        return [];
      }
      const { descripcion, und, costo_unitario } = apu;
      return [{ id: f.id, item: f.item, descripcion, und, costo_unitario, cantidad_expr: f.cantidad_expr, cantidad: r.valor, costo_directo: costoDirecto(r.valor, costo_unitario) }];
    });
    return { id: c.id, nombre: c.nombre, subtotal: filas.reduce((s, f) => s + f.costo_directo, 0), filas };
  });
  return { capitulos: armados, costo_directo_total: armados.reduce((s, c) => s + c.subtotal, 0), desconocidos };
}
