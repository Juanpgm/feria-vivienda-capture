import { describe, expect, it } from "vitest";
import { resolverTemaOscuro } from "./tema";

describe("resolverTemaOscuro", () => {
  it("follows the system when nothing is stored", () => {
    expect(resolverTemaOscuro(null, true)).toBe(true);
    expect(resolverTemaOscuro(null, false)).toBe(false);
  });
  it("explicit choice wins over the system", () => {
    expect(resolverTemaOscuro("claro", true)).toBe(false);
    expect(resolverTemaOscuro("oscuro", false)).toBe(true);
  });
  it("ignores unknown stored values", () => {
    expect(resolverTemaOscuro("x", true)).toBe(true);
  });
});
