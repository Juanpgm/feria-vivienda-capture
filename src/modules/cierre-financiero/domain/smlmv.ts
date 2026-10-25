// SMLMV value and income brackets: the only place either is defined.

/** Monthly legal minimum wage (COP) by year. Add a year here when it changes. */
export const SMLMV_POR_ANIO: Readonly<Record<number, number>> = { 2026: 1_750_905 };
export const ANIO_SMLMV = 2026;
export const SMLMV = SMLMV_POR_ANIO[ANIO_SMLMV];

/**
 * Brackets per PDF section 4: "De 0 a 4", "De >4 a 5.5", "Superior a 5.5".
 * `hasta` is INCLUSIVE (4 and 5.5 belong to the lower bracket); lower edge is exclusive.
 * Ordered ascending; the last one is open-ended.
 */
export const RANGOS_SMLMV = [
  { codigo: "0_4", hasta: 4, etiqueta: "De 0 a 4 SMLMV" },
  { codigo: "4_5_5", hasta: 5.5, etiqueta: "De >4 a 5.5 SMLMV" },
  { codigo: "mas_5_5", hasta: Infinity, etiqueta: "Superior a 5.5 SMLMV" },
] as const;
export type RangoSmlmv = (typeof RANGOS_SMLMV)[number]["codigo"];

export const formatoCop = (v: number) => `$${v.toLocaleString("es-CO")} COP`;

/** Bracket for an income in pesos, plus the exact multiple (2 decimals) and the SMLMV applied. */
export function derivarIngreso(ingresoCop: number, smlmv = SMLMV, anio = ANIO_SMLMV) {
  // Compare in pesos (no rounded ratio) so edge values like exactly 4 SMLMV classify exactly.
  const rango = RANGOS_SMLMV.find((r) => ingresoCop <= r.hasta * smlmv) ?? RANGOS_SMLMV[2];
  return {
    ingreso_en_smlmv: Math.round((ingresoCop / smlmv) * 100) / 100,
    rango_ingresos_smlmv: rango.codigo,
    valor_smlmv_aplicado: smlmv,
    anio_smlmv: anio,
  };
}
