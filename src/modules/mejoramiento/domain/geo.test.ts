import { describe, expect, it } from "vitest";
import limites from "../catalogo/limites.json";
import { contiene, ubicar, type Geometria, type Limites } from "./geo";

const cuadro = (x: number, y: number, l: number) => [[x, y], [x + l, y], [x + l, y + l], [x, y + l], [x, y]];

describe("contiene", () => {
  it("handles holes and multipolygons", () => {
    const conHueco: Geometria = { type: "Polygon", coordinates: [cuadro(0, 0, 10), cuadro(4, 4, 2)] };
    expect(contiene(conHueco, 1, 1)).toBe(true);
    expect(contiene(conHueco, 5, 5)).toBe(false);
    expect(contiene(conHueco, 11, 5)).toBe(false);
    const multi: Geometria = { type: "MultiPolygon", coordinates: [[cuadro(0, 0, 1)], [cuadro(5, 5, 1)]] };
    expect(contiene(multi, 5.5, 5.5)).toBe(true);
    expect(contiene(multi, 3, 3)).toBe(false);
  });
});

describe("ubicar on the Cali basemaps", () => {
  const l = limites as unknown as Limites;
  it("finds comuna and barrio for urban points", () => {
    expect(ubicar(l, -76.53237, 3.45163)).toEqual({
      comuna_corregimiento: { tipo: "comuna", codigo: "03", nombre: "Comuna 3" },
      barrio_vereda: { tipo: "barrio", id: "0311", nombre: "San Pedro" },
    });
    expect(ubicar(l, -76.53308, 3.37637).barrio_vereda?.id).toBe("1705");
  });
  it("finds corregimiento and vereda for rural points", () => {
    expect(ubicar(l, -76.6214, 3.3236)).toEqual({
      comuna_corregimiento: { tipo: "corregimiento", codigo: "53", nombre: "Pance" },
      barrio_vereda: { tipo: "vereda", id: "V5303", nombre: "San Francisco" },
    });
  });
  it("returns nulls outside Cali", () => {
    expect(ubicar(l, -80, 0)).toEqual({ comuna_corregimiento: null, barrio_vereda: null });
  });
});
