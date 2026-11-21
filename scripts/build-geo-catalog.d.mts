export type Division = { tipo: "comuna" | "corregimiento"; codigo: string; nombre: string; sector: "urbano" | "rural" };
export type Lugar = { id: string; nombre: string; tipo_division: Division["tipo"]; codigo_division: string; sector: Division["sector"] };
export function construirCatalogo(
  comunasGeo: { features: { properties: Record<string, unknown> }[] },
  barriosGeo: { features: { properties: Record<string, unknown> }[] },
): { divisiones: Division[]; barrios: Lugar[]; reporte: { huerfanos: string[]; corregimientosSinVeredas: string[] } };
export type Geometria = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
export function construirLimites(
  comunasGeo: { features: { properties: Record<string, unknown>; geometry: Geometria | null }[] },
  barriosGeo: { features: { properties: Record<string, unknown>; geometry: Geometria | null }[] },
): {
  divisiones: { tipo: "comuna" | "corregimiento"; codigo: string; nombre: string; geometria: Geometria }[];
  lugares: { tipo: "barrio" | "vereda"; id: string; nombre: string; geometria: Geometria }[];
};
