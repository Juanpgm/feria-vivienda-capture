// Builds the static catalogs of the postulación form from two official open-data files (downloaded by hand):
//   1. DIVIPOLA municipios (DANE):  https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000
//   2. Estrato moda por barrio, Cali 2015 (DAP): https://datos.cali.gov.co/dataset/area-barrios-de-cali-2015
//   3. Entidades vigiladas por la Superfinanciera: https://www.datos.gov.co/resource/sr9n-792w.json?$limit=5000
//   4. Cajas de compensación (Supersubsidio): https://www.datos.gov.co/resource/ese3-e6sh.json?$select=ccf&$group=ccf
// Run: node scripts/build-catalogos-postulacion.mjs <municipios.json> <barrios2015.csv> [<vigiladas.json> <cajas.json>]
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

// Superfinanciera entity types kept (dataset sr9n-792w, column tipo_entidad).
const TIPOS_SFC = { 1: "banco", 2: "corporacion_financiera", 4: "compania_financiamiento", 22: "entidad_oficial", 23: "fondo_cesantias", 32: "cooperativa_financiera" };
// Display names where the legal name is long or generic, by NIT.
const NOMBRE_POR_NIT = {
  8001381881: "Protección (fondo de pensiones y cesantías)",
  8001443313: "Porvenir (fondo de pensiones y cesantías)",
  8001485142: "Skandia (fondo de pensiones y cesantías)",
  8001494962: "Colfondos (fondo de pensiones y cesantías)",
  8999992844: "Fondo Nacional del Ahorro (FNA)",
  8909039370: "Banco Itaú",
  8600030201: "BBVA Colombia",
  8600511354: "Citibank Colombia",
  8902030889: "Banco Cooperativo Coopcentral",
  8600259715: "Mibanco",
  9002009609: "Ban100",
  9006880663: "Financiera Juriscoop",
  8999990357: "ICETEX",
  8000963291: "Findeter",
};
// Cajas whose name in the dataset has no usable short brand, by full name.
const CAJA_CORTA = {
  "Caja de Compensación Familiar de Fenalco: Andi COMFENALCO CARTAGENA": "Comfenalco Cartagena",
  "Caja de Compensación Familiar de Cartagena y Bolivar COMFAMILIAR": "Comfamiliar Cartagena y Bolívar",
  "Caja de Compensación Familiar de Fenalco del Tolima: COMFENALCO": "Comfenalco Tolima",
  "Caja de Compensación Familiar COMFAMILIAR Del Atlántico": "Comfamiliar Atlántico",
  "Caja de Compensación Familiar de Nariño": "Comfamiliar de Nariño",
  "Caja de Compensación Familiar de Sucre": "Comfasucre",
  "Caja de Compensación Familiar del Choco": "Comfachocó",
  "Caja de Compensación Familiar del Magdalena": "Cajamag",
};
const SIGLAS = new Set(["AV", "GNB", "BNP", "CFA", "JFK", "CF", "GM", "RCI", "BTG", "FINDETER", "FINAGRO", "FOGACOOP", "J.P.", "W", "CO"]);
const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "el", "en"]);
const nombrePropio = (s) =>
  s.split(" ").map((w, i) => (SIGLAS.has(w.toUpperCase()) ? w.toUpperCase() : i > 0 && MINUSCULAS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(" ");
const CORTE = /,| \(| y podr| podr| pudiendo| quien| que podr| cuya| la cual| pero | es la denominaci| en adelante| y\/o | o BANCO| o MUNDO| y en sus relaciones/i;
export function limpiarRazonSocial(s) {
  let t = s.trim();
  const m = t.search(CORTE);
  if (m > 3) t = t.slice(0, m);
  return nombrePropio(t.replace(/\s+(S\.?A\.?S?\.?|BIC)(?=\s|$)/gi, " ").replace(/\s+-\s*/g, " - ").replace(/\s+/g, " ").trim().replace(/[\s.,-]+$/, ""));
}

/** Short brand of a caja de compensación ("…del Valle del Cauca: COMFENALCO VALLE" -> "Comfenalco Valle"). */
function corta(caja) {
  if (CAJA_CORTA[caja]) return CAJA_CORTA[caja];
  const i = caja.lastIndexOf(":");
  if (i >= 0) return nombrePropio(caja.slice(i + 1).trim());
  const m = /\b([A-ZÁÉÍÓÚÑ]{4,}(?: [A-ZÁÉÍÓÚÑ]+)*)$/.exec(caja.trim());
  return m ? nombrePropio(m[1]) : caja.trim();
}

/** Public bodies that grant housing subsidies or contributions (not in either dataset). */
const PUBLICAS = [
  "Ministerio de Vivienda, Ciudad y Territorio - Fonvivienda (Mi Casa Ya)",
  "Alcaldía de Santiago de Cali - Secretaría de Vivienda Social y Hábitat",
  "Gobernación del Valle del Cauca",
];

/** `{ nombre, tipo, keywords? }`, sorted by name: Superfinanciera entities, cajas de compensación and public bodies. */
export function construirEntidades(vigiladas, cajas) {
  const sfc = vigiladas
    .filter((r) => TIPOS_SFC[r.tipo_entidad])
    .map((r) => ({ nombre: NOMBRE_POR_NIT[r.numeroidentificacion] ?? limpiarRazonSocial(r.razon_social), tipo: TIPOS_SFC[r.tipo_entidad] }));
  const ccf = cajas.map((c) => ({ nombre: corta(c.ccf), tipo: "caja_compensacion", keywords: c.ccf }));
  const pub = PUBLICAS.map((nombre) => ({ nombre, tipo: "entidad_publica" }));
  const vistos = new Set();
  return [...sfc, ...ccf, ...pub]
    .filter((e) => !vistos.has(e.nombre) && vistos.add(e.nombre))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

if (process.argv[1]?.endsWith("build-catalogos-postulacion.mjs")) {
  const [, , municipios, barrios, vigiladas, cajas] = process.argv;
  if (vigiladas && cajas) {
    const ent = construirEntidades(JSON.parse(readFileSync(vigiladas, "utf8")), JSON.parse(readFileSync(cajas, "utf8")));
    writeFileSync(new URL("../src/modules/postulacion/catalogo/entidades.json", import.meta.url), JSON.stringify(ent) + "\n");
    console.log(`entidades: ${ent.length}`);
  }
  const m = construirMunicipios(JSON.parse(readFileSync(municipios, "utf8")));
  const e = construirEstratos(readFileSync(barrios, "utf8"));
  writeFileSync(new URL("../src/shared/catalogo/municipios.json", import.meta.url), JSON.stringify(m) + "\n");
  writeFileSync(new URL("../src/modules/inmueble/catalogo/estratos.json", import.meta.url), JSON.stringify(e) + "\n");
  console.log(`municipios: ${m.length}, barrios con estrato: ${Object.keys(e).length}`);
}
