export type Division = { tipo: "comuna" | "corregimiento"; codigo: string; nombre: string; sector: "urbano" | "rural" };
export type Lugar = { id: string; nombre: string; tipo_division: Division["tipo"]; codigo_division: string; sector: Division["sector"] };
export function construirCatalogo(
  comunasGeo: { features: { properties: Record<string, unknown> }[] },
  barriosGeo: { features: { properties: Record<string, unknown> }[] },
): { divisiones: Division[]; barrios: Lugar[]; reporte: { huerfanos: string[]; corregimientosSinVeredas: string[] } };
