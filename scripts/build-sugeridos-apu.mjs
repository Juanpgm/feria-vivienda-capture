// Builds src/modules/mejoramiento/catalogo/sugeridos.json ("Actividades frecuentes") from the example budgets of
// sheet "PRESUPUESTO TOPOP": `comunes` = ITEMs present in every example budget, `por_capitulo` = the other ITEMs of
// each chapter, keyed by the APLICA_PARA key. Both keep the order of first appearance.
//   node scripts/build-sugeridos-apu.mjs "ruta/presupuestos.xlsx"
import { writeFileSync } from "node:fs";
import readXlsxFile from "read-excel-file/node";
import { normalizarItem } from "../src/modules/mejoramiento/domain/apus.ts";

const archivo = process.argv[2];
if (!archivo) throw new Error("Falta la ruta del Excel");
const SALIDA = "src/modules/mejoramiento/catalogo/sugeridos.json";
const CAPITULOS = { PISO: "piso", "BAÑO": "bano", COCINA: "cocina", "ALCANTARILLADO Y PISO": "alcantarillado_piso" };

const hoja = (await readXlsxFile(archivo)).find((h) => h.sheet === "PRESUPUESTO TOPOP");
if (!hoja) throw new Error('El libro no tiene la hoja "PRESUPUESTO TOPOP"');

/** One Set of ITEMs per example budget; ITEMs per chapter key. */
const presupuestos = [];
const porCapitulo = {};
let actual = null;
let capitulo = null;
for (const [a, b] of hoja.data) {
  const titulo = typeof a === "string" ? a.trim().toUpperCase() : "";
  if (titulo === "PRESUPUESTO MEJORAMIENTO DE VIVIENDA") presupuestos.push((actual = new Set()));
  else if (titulo.startsWith("COSTO DIRECTO")) actual = capitulo = null;
  else if (!actual || a == null || titulo === "ÍTEM") continue;
  else if (b == null) capitulo = CAPITULOS[titulo] ?? null;
  else {
    const item = normalizarItem(a);
    actual.add(item);
    if (capitulo) (porCapitulo[capitulo] ??= new Set()).add(item);
  }
}
if (!presupuestos.length) throw new Error("No se encontraron presupuestos de ejemplo");

const comunes = [...presupuestos[0]].filter((i) => presupuestos.every((p) => p.has(i)));
const por_capitulo = Object.fromEntries(Object.entries(porCapitulo).map(([k, s]) => [k, [...s].filter((i) => !comunes.includes(i))]));
writeFileSync(SALIDA, `${JSON.stringify({ comunes, por_capitulo }, null, 2)}\n`);
console.log(`Presupuestos: ${presupuestos.length}. Comunes: ${comunes.length}. ${Object.entries(por_capitulo).map(([k, v]) => `${k}: ${v.length}`).join(", ")}.`);
