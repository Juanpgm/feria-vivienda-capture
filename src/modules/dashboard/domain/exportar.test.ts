import { describe, expect, it } from "vitest";
import { aFilas, aplanar } from "./exportar";

describe("exportar", () => {
  it("flattens nested objects, arrays and timestamps", () => {
    const fecha = new Date("2026-01-02T03:04:05.000Z");
    expect(aplanar({ a: { b: 1, c: ["x", "y"] }, t: { toDate: () => fecha }, n: null })).toEqual({
      "a.b": 1,
      "a.c": "x, y",
      t: "2026-01-02T03:04:05.000Z",
      n: null,
    });
  });

  it("builds a header from the union of keys and pads missing cells", () => {
    expect(aFilas([{ a: 1 }, { b: 2 }])).toEqual([["a", "b"], [1, null], [null, 2]]);
  });
});
