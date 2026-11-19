// Builds the static catalogs of the postulación form from two official open-data files (downloaded by hand):
//   1. DIVIPOLA municipios (DANE):  https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000
//   2. Estrato moda por barrio, Cali 2015 (DAP): https://datos.cali.gov.co/dataset/area-barrios-de-cali-2015
// Run: node scripts/build-catalogos-postulacion.mjs <municipios.json> <barrios2015.csv>
import { readFileSync, writeFileSync } from "node:fs";

const titulo = (s) =>
  s.toLocaleLowerCase("es-CO").replace(/(^|[\s\-(.])(\p{L})/gu, (_, a, l) => a + l.toLocaleUpperCase("es-CO")).replace(/\b(De|Del|La|Las|Los|Y|El)\b/g, (w, _m, i) => (i === 0 ? w : w.toLowerCase()));

export function construirMunicipios(filas) {
  return filas
    .map((f) => ({ codigo: f.cod_mpio, nombre: titulo(f.nom_mpio), departamento: titulo(f.dpto) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.departamento.localeCompare(b.departamento, "es"));
}

/** `{ "0206": 5 }`: barrio id of the basemap catalog (4 digits) -> estrato moda 1-6. Other values (0, 10, empty) are dropped. */
export function construirEstratos(csv) {
  const [cabecera, ...lineas] = csv.trim().split(/\r?\n/);
  const cols = cabecera.split(",");
  const iCod = cols.indexOf("Cod_barrio");
  const iEst = cols.indexOf("Estrato_moda");
  const out = {};
  for (const l of lineas) {
    const c = l.split(",");
    const e = Number(c[iEst]);
    if (Number.isInteger(e) && e >= 1 && e <= 6) out[String(c[iCod]).padStart(4, "0")] = e;
  }
  return out;
}

if (process.argv[1]?.endsWith("build-catalogos-postulacion.mjs")) {
  const [, , municipios, barrios] = process.argv;
  const m = construirMunicipios(JSON.parse(readFileSync(municipios, "utf8")));
  const e = construirEstratos(readFileSync(barrios, "utf8"));
  writeFileSync(new URL("../src/shared/catalogo/municipios.json", import.meta.url), JSON.stringify(m) + "\n");
  writeFileSync(new URL("../src/modules/inmueble/catalogo/estratos.json", import.meta.url), JSON.stringify(e) + "\n");
  console.log(`municipios: ${m.length}, barrios con estrato: ${Object.keys(e).length}`);
}
