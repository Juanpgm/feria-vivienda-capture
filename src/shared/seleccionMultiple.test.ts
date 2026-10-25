import { describe, expect, it } from "vitest";
import { alternarSeleccion } from "./seleccionMultiple";

describe("alternarSeleccion", () => {
  it("adds and removes plain options", () => {
    expect(alternarSeleccion([], "a", true)).toEqual(["a"]);
    expect(alternarSeleccion(["a", "b"], "a", false)).toEqual(["b"]);
  });
  it("does not duplicate an already selected option", () => {
    expect(alternarSeleccion(["a"], "a", true, "ninguna")).toEqual(["a"]);
  });
  it("the exclusive option clears everything else", () => {
    expect(alternarSeleccion(["a", "b"], "ninguna", true, "ninguna")).toEqual(["ninguna"]);
    expect(alternarSeleccion(["ninguna"], "ninguna", false, "ninguna")).toEqual([]);
  });
  it("choosing another option drops the exclusive one", () => {
    expect(alternarSeleccion(["ninguna"], "a", true, "ninguna")).toEqual(["a"]);
  });
  it("without an exclusive option 'ninguna' is a normal value", () => {
    expect(alternarSeleccion(["a"], "ninguna", true)).toEqual(["a", "ninguna"]);
  });
});
