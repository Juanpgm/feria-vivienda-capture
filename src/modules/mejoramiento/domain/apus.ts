// APU catalogue built from the "LISTADO DE PRECIOS" sheet of the budget workbook. Pure: shared by the import
// script (scripts/importar-apus.mjs) and the server. Plain TypeScript (no enums) so Node can strip the types.

export type Apu = {
  /** Unique APU code (Firestore doc id in "APUS"). */
  item: string;
  descripcion: string;
  und: string;
  /** Pesos per unit, whole number. */
  costo_unitario: number;
  capitulo: string;
  capitulo_nombre: string;
  /** Origin reference of the SVSH APUs (column E, e.g. "INP 2"). */
  fuente?: string;
};

const texto = (v: unknown) => String(v ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

/** Excel stored chapters 01-09 as 5-digit ints (leading zero lost): pad them back to 6. */
export function normalizarItem(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) && v >= 10000 && v < 100000 ? String(v).padStart(6, "0") : String(v);
  return texto(v).toUpperCase();
}

const ALIAS_UNIDAD: Record<string, string> = { M3K: "M3-KM", PTO: "PUNTO" };

export function normalizarUnidad(v: unknown): string {
  const u = texto(v).toUpperCase().replace(/\s*-\s*/g, "-");
  return ALIAS_UNIDAD[u] ?? u;
}

/** Chapter key from the code: SVSH APUs, sub-mix prefixes (ME), 6-digit trade chapters, else the SIM list. */
function capituloDe(item: string): string {
  if (item.startsWith("APU ")) return "SVSH";
  const letras = /^([A-Z]+)\d/.exec(item);
  if (letras) return letras[1];
  if (/^\d{6}$/.test(item)) return item.slice(0, 2);
  return "SIM";
}

/** Top-level chapter header rows: "ME", "SVSH", a 1-2 digit chapter number, or the untitled infrastructure list. */
function claveEncabezado(codigo: unknown): string | null {
  if (codigo == null || codigo === "") return "SIM";
  if (typeof codigo === "number") return Number.isInteger(codigo) && codigo < 100 ? String(codigo).padStart(2, "0") : null;
  const c = texto(codigo).toUpperCase();
  if (/^\d{1,2}$/.test(c)) return c.padStart(2, "0");
  return /^[A-Z]{2,4}$/.test(c) ? c : null;
}

export function construirApus(filas: unknown[][]): { apus: Apu[]; duplicados: string[]; omitidas: string[] } {
  const nombres = new Map<string, string>();
  const apus: Apu[] = [];
  const vistos = new Set<string>();
  const duplicados: string[] = [];
  const omitidas: string[] = [];
  const inicio = filas.findIndex((f) => texto(f[0]).toUpperCase() === "ITEM") + 1;

  for (const [codigo, descripcion, und, costo, fuente] of filas.slice(inicio)) {
    if (und == null || und === "") {
      const clave = claveEncabezado(codigo);
      if (clave && !nombres.has(clave) && descripcion) nombres.set(clave, texto(descripcion));
      continue;
    }
    const item = normalizarItem(codigo);
    if (!item) continue;
    if (typeof costo !== "number" || !Number.isFinite(costo) || costo < 0) {
      omitidas.push(item);
      continue;
    }
    if (vistos.has(item)) {
      duplicados.push(item);
      continue;
    }
    vistos.add(item);
    const capitulo = capituloDe(item);
    const ref = texto(fuente);
    apus.push({
      item,
      descripcion: texto(descripcion),
      und: normalizarUnidad(und),
      costo_unitario: Math.round(costo),
      capitulo,
      capitulo_nombre: nombres.get(capitulo) ?? capitulo,
      ...(ref && { fuente: ref }),
    });
  }
  return { apus, duplicados, omitidas };
}
