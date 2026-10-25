import { describe, expect, it } from "vitest";
import { filtrarOpciones, normalizarBusqueda } from "./busqueda";

const ops = [
  { value: "a", label: "Ángela Pérez" },
  { value: "b", label: "Santiago de Cali" },
  { value: "c", label: "Peñón", keywords: "barrio centro" },
  { value: "d", label: "El Peñasco" },
];

describe("busqueda", () => {
  it("normalizes accents, case and spaces", () => {
    expect(normalizarBusqueda("  ÁNGEL   María ")).toBe("angel maria");
  });
  it("matches ignoring accents and case", () => {
    expect(filtrarOpciones(ops, "angela").map((o) => o.value)).toEqual(["a"]);
    expect(filtrarOpciones(ops, "PEREZ").map((o) => o.value)).toEqual(["a"]);
  });
  it("ranks label-prefix before inner-word and substring matches", () => {
    expect(filtrarOpciones(ops, "pe").map((o) => o.value)).toEqual(["c", "a", "d"]);
    expect(filtrarOpciones(ops, "nasco").map((o) => o.value)).toEqual(["d"]);
  });
  it("requires all words, searches keywords, returns all for empty query, honors limit", () => {
    expect(filtrarOpciones(ops, "pe centro").map((o) => o.value)).toEqual(["c"]);
    expect(filtrarOpciones(ops, "zzz")).toEqual([]);
    expect(filtrarOpciones(ops, "")).toHaveLength(4);
    expect(filtrarOpciones(ops, "", 2)).toHaveLength(2);
  });
});
