// "Calculadora de medidas": turns measured lines (largo × ancho × alto) into the memoria de cálculo expression
// that evaluarCantidad reads and cantidad_expr stores, e.g. "(2*3,5)-(1,2*2)" (decimal comma, like the inspector types).

export type Dimension = "largo" | "ancho" | "alto";
export type Medida = Partial<Record<Dimension, string>> & { descontar?: boolean };

const POR_UNIDAD: Record<string, readonly Dimension[]> = {
  M2: ["largo", "ancho"],
  M3: ["largo", "ancho", "alto"],
  M: ["largo"],
  ML: ["largo"],
};

/** Measurements the unit needs; null when the unit has no calculator (UND, PUNTO, ...). */
export const dimensionesDe = (und?: string): readonly Dimension[] | null => POR_UNIDAD[(und ?? "").trim().toUpperCase()] ?? null;

const numero = (s?: string) => {
  const t = (s ?? "").trim().replace(",", ".");
  const n = /^\d*\.?\d+$/.test(t) ? Number(t) : NaN;
  return n > 0 ? n : null;
};

/** Expression of the complete lines; incomplete or invalid lines are left out. "" when nothing is usable. */
export function expresionMedidas(und: string | undefined, medidas: readonly Medida[]): string {
  const dims = dimensionesDe(und);
  if (!dims) return "";
  let out = "";
  for (const m of medidas) {
    const valores = dims.map((d) => numero(m[d]));
    if (valores.some((v) => v === null)) continue;
    const termino = `(${valores.map((v) => String(v).replace(".", ",")).join("*")})`;
    out += m.descontar ? `-${termino}` : `${out ? "+" : ""}${termino}`;
  }
  return out;
}
