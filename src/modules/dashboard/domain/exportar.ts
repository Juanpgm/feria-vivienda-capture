type Plano = Record<string, string | number | boolean | null>;

const esTimestamp = (v: unknown): v is { toDate(): Date } => !!v && typeof (v as { toDate?: unknown }).toDate === "function";

/** Flattens a stored registro into one row: nested keys become "a.b", arrays are joined, Timestamps become ISO text. */
export function aplanar(valor: unknown, prefijo = "", salida: Plano = {}): Plano {
  if (esTimestamp(valor)) salida[prefijo] = valor.toDate().toISOString();
  else if (Array.isArray(valor)) salida[prefijo] = valor.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  else if (valor && typeof valor === "object") for (const [k, v] of Object.entries(valor)) aplanar(v, prefijo ? `${prefijo}.${k}` : k, salida);
  else salida[prefijo] = (valor as Plano[string]) ?? null;
  return salida;
}

/** Header row = union of every key (first-seen order), so registros with optional sections still line up. */
export function aFilas(registros: Plano[]): (string | number | boolean | null)[][] {
  const columnas = [...new Set(registros.flatMap((r) => Object.keys(r)))];
  return [columnas, ...registros.map((r) => columnas.map((c) => r[c] ?? null))];
}
