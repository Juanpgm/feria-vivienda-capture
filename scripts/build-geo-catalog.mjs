// Builds geometry-free catalogs from the basemap GeoJSON files. Run: npm run build:catalog
// Urban: comunas (COMUNA is an int, e.g. 1) own barrios (COMUNA is a zero-padded string, e.g. "01").
// Rural: veredas exist only as overlay attributes on barrios_veredas rows; they are deduped by ID_VEREDA
// and linked to their corregimiento (ID_CORREG). A corregimiento without veredas falls back to free text in the UI.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pad2 = (v) => String(v).padStart(2, "0");
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true });

export function construirCatalogo(comunasGeo, barriosGeo) {
  const divisiones = [];
  const seenDiv = new Set();
  for (const { properties: p } of comunasGeo.features) {
    const esComuna = p.COMUNA != null;
    const codigo = esComuna ? pad2(p.COMUNA) : p.ID_CORREG != null ? String(p.ID_CORREG) : null;
    if (codigo === null) continue;
    const tipo = esComuna ? "comuna" : "corregimiento";
    if (seenDiv.has(tipo + codigo)) continue;
    seenDiv.add(tipo + codigo);
    divisiones.push({
      tipo,
      codigo,
      nombre: esComuna ? p.NOMBRE : p.CORREGIMIE,
      sector: esComuna ? "urbano" : "rural",
    });
  }
  const comunas = new Set(divisiones.filter((d) => d.tipo === "comuna").map((d) => d.codigo));
  const corregs = new Set(divisiones.filter((d) => d.tipo === "corregimiento").map((d) => d.codigo));

  const barrios = new Map();
  const veredas = new Map();
  const huerfanos = [];
  for (const { properties: p } of barriosGeo.features) {
    if (p.BARRIO) {
      const comuna = pad2(p.COMUNA);
      if (!comunas.has(comuna)) huerfanos.push(`barrio ${p.ID_BARRIO} comuna ${comuna}`);
      else barrios.set(p.ID_BARRIO, { id: p.ID_BARRIO, nombre: p.BARRIO, tipo_division: "comuna", codigo_division: comuna, sector: "urbano" });
    }
    if (p.VEREDA) {
      const corr = String(p.ID_CORREG);
      const id = `V${p.ID_VEREDA}`;
      if (!corregs.has(corr)) huerfanos.push(`vereda ${id} corregimiento ${corr}`);
      else veredas.set(id, { id, nombre: p.VEREDA, tipo_division: "corregimiento", codigo_division: corr, sector: "rural" });
    }
  }
  const lugares = [...barrios.values(), ...veredas.values()].sort(porNombre);
  const sinVeredas = divisiones.filter((d) => d.tipo === "corregimiento" && !lugares.some((l) => l.codigo_division === d.codigo));
  divisiones.sort((a, b) => a.sector.localeCompare(b.sector) || a.codigo.localeCompare(b.codigo));
  return { divisiones, barrios: lugares, reporte: { huerfanos, corregimientosSinVeredas: sinVeredas.map((d) => d.nombre) } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
  const leer = (f) => JSON.parse(readFileSync(join(raiz, "basemaps", f), "utf8"));
  const { divisiones, barrios, reporte } = construirCatalogo(leer("comunas_corregimientos.geojson"), leer("barrios_veredas.geojson"));
  const out = join(raiz, "src/modules/inmueble/catalogo");
  mkdirSync(out, { recursive: true });
  const filas = (a) => "[\n" + a.map((x) => JSON.stringify(x)).join(",\n") + "\n]\n";
  writeFileSync(join(out, "divisiones.json"), filas(divisiones));
  writeFileSync(join(out, "barrios.json"), filas(barrios));
  console.log(`divisiones: ${divisiones.length}, barrios+veredas: ${barrios.length}`);
  console.log("orphans:", reporte.huerfanos.length, "| corregimientos without veredas:", reporte.corregimientosSinVeredas.join(", ") || "none");
}
