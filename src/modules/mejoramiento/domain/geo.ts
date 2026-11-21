// Point-in-polygon lookup of comuna/corregimiento and barrio/vereda from the basemaps (catalogo/limites.json,
// built by scripts/build-geo-catalog.mjs). Coordinates are [lon, lat] (WGS84), as in GeoJSON.

type Anillo = number[][];
export type Geometria = { type: "Polygon"; coordinates: Anillo[] } | { type: "MultiPolygon"; coordinates: Anillo[][] };
export type Limites = {
  divisiones: { tipo: "comuna" | "corregimiento"; codigo: string; nombre: string; geometria: Geometria }[];
  lugares: { tipo: "barrio" | "vereda"; id: string; nombre: string; geometria: Geometria }[];
};
export type Ubicacion = {
  comuna_corregimiento: { tipo: "comuna" | "corregimiento"; codigo: string; nombre: string } | null;
  barrio_vereda: { tipo: "barrio" | "vereda"; id: string; nombre: string } | null;
};

/** Ray casting (even-odd) on one ring. */
function dentroDeAnillo(lon: number, lat: number, anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Inside the outer ring and outside every hole. */
const dentroDePoligono = (lon: number, lat: number, [exterior, ...huecos]: Anillo[]) =>
  dentroDeAnillo(lon, lat, exterior) && !huecos.some((h) => dentroDeAnillo(lon, lat, h));

export function contiene(g: Geometria, lon: number, lat: number): boolean {
  return g.type === "Polygon" ? dentroDePoligono(lon, lat, g.coordinates) : g.coordinates.some((p) => dentroDePoligono(lon, lat, p));
}

// ponytail: linear scan over ~480 polygons per lookup (one per visit submit); add bbox prefilter if it ever shows up.
export function ubicar(limites: Limites, lon: number, lat: number): Ubicacion {
  const d = limites.divisiones.find((x) => contiene(x.geometria, lon, lat));
  const l = limites.lugares.find((x) => contiene(x.geometria, lon, lat));
  return {
    comuna_corregimiento: d ? { tipo: d.tipo, codigo: d.codigo, nombre: d.nombre } : null,
    barrio_vereda: l ? { tipo: l.tipo, id: l.id, nombre: l.nombre } : null,
  };
}
