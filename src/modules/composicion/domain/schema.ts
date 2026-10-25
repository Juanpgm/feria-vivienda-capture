import { z } from "zod";
import { CONDICIONES_ESPECIALES } from "@/shared/constantes";
import { parsearIngresoCop } from "@/shared/normalizacion/texto";
import { derivarIngreso } from "@/modules/cierre-financiero/domain/smlmv";
import { entero, listaExclusiva } from "@/shared/validacion";
import { bandaAdultoMayor, bandaHogar } from "./derivaciones";

/** Accepts integer pesos or text like "1.500.000", "1500000 COP", "$1,500,000". */
const ingresoCop = z
  .union([z.number(), z.string()], { error: "Ingrese un valor numérico en pesos" })
  .transform((v) => (typeof v === "number" ? v : parsearIngresoCop(v)))
  .pipe(z.number({ error: "Ingrese un valor numérico en pesos" }).int("Ingrese un valor numérico en pesos").min(0, "No puede ser negativo"));

/** Household composition, special protection and income (form sections 1.2-1.4). */
export const composicionSchema = z
  .object({
    cantidad_personas_hogar: entero().pipe(z.number().min(1, "Debe ser al menos 1")),
    tiene_adulto_mayor: z.boolean({ error: "Seleccione Sí o No" }),
    cantidad_adultos_mayores: entero().nullish(),
    adultos_mayores: z.array(z.object({ edad: entero().pipe(z.number().min(60, "Edad mínima 60").max(120, "Edad máxima 120")) })).nullish(),
    condiciones_especiales: listaExclusiva(CONDICIONES_ESPECIALES),
    ingreso_hogar_cop: ingresoCop,
  })
  .superRefine((v, ctx) => {
    if (!v.tiene_adulto_mayor) return;
    const n = v.cantidad_adultos_mayores;
    if (!n || n < 1) ctx.addIssue({ code: "custom", path: ["cantidad_adultos_mayores"], message: "Indique cuántos adultos mayores hay (mínimo 1)" });
    else if (v.adultos_mayores?.length !== n)
      ctx.addIssue({ code: "custom", path: ["adultos_mayores"], message: "Indique la edad de cada adulto mayor" });
  })
  .transform((v) => {
    const edades = v.tiene_adulto_mayor ? (v.adultos_mayores ?? []) : [];
    return {
      cantidad_personas_hogar: v.cantidad_personas_hogar,
      rango_tamano_hogar: bandaHogar(v.cantidad_personas_hogar),
      tiene_adulto_mayor: v.tiene_adulto_mayor,
      // Cleared (null/[]) when there is no older adult.
      cantidad_adultos_mayores: v.tiene_adulto_mayor ? edades.length : null,
      adultos_mayores: edades,
      rango_adulto_mayor: bandaAdultoMayor(edades.map((e) => e.edad)),
      condiciones_especiales: v.condiciones_especiales,
      ingreso_hogar_cop: v.ingreso_hogar_cop,
      ...derivarIngreso(v.ingreso_hogar_cop),
    };
  });

export type Composicion = z.output<typeof composicionSchema>;
