import { describe, expect, it } from "vitest";
import { normalizarTelefono, regionDeCodigo, regionPorDefecto, resolverTelefono, textoNacional } from "./telefono";

describe("telefono con region", () => {
  it("defaults to Colombia and honors the selected region", () => {
    expect(normalizarTelefono("300 555 0100")).toBe("+573005550100");
    expect(normalizarTelefono("412 123 4567", "VE")).toBe("+584121234567");
    expect(normalizarTelefono("412 123 4567")).toBeNull();
  });

  it("preselects the nationality's code only for CE / Otro", () => {
    expect(regionPorDefecto("cc", "VE")).toBe("CO");
    expect(regionPorDefecto("ce", "VE")).toBe("VE");
    expect(regionPorDefecto("otro", "ES")).toBe("ES");
    expect(regionPorDefecto("ce", undefined)).toBe("CO");
    expect(regionPorDefecto("ce", "")).toBe("CO");
    expect(regionPorDefecto(undefined, "VE")).toBe("CO");
    expect(regionPorDefecto("ce", "ZZ")).toBe("CO");
  });

  it("resolves national digits under the selected region", () => {
    expect(resolverTelefono("300 555 0100", "CO")).toEqual({ valor: "+573005550100", region: "CO" });
    expect(resolverTelefono("0412 1234567", "VE")).toEqual({ valor: "+584121234567", region: "VE" });
    expect(resolverTelefono("   ", "CO")).toEqual({ valor: "", region: "CO" });
  });

  it("lets a pasted +code win over the selected region", () => {
    expect(resolverTelefono("+58 412 123 4567", "CO")).toEqual({ valor: "+584121234567", region: "VE" });
    expect(resolverTelefono("(+57) 304-555-0104", "VE")).toEqual({ valor: "+573045550104", region: "CO" });
    expect(resolverTelefono("+58 41", "CO")).toEqual({ valor: "+5841", region: "VE" }); // partial: region follows too
  });

  it("keeps an incomplete number under its own code so it cannot validate elsewhere", () => {
    const r = resolverTelefono("3005550100", "US"); // valid in CO, not in US
    expect(r).toEqual({ valor: "+13005550100", region: "US" });
    expect(normalizarTelefono(r.valor)).toBeNull();
    expect(resolverTelefono("123", "CO").valor).toBe("+57123");
  });

  it("shares +1 between countries without flipping the chosen one", () => {
    expect(regionDeCodigo("1", "CA")).toBe("CA");
    expect(regionDeCodigo("1", "CO")).toBe("US");
    expect(resolverTelefono("202 555 0123", "CA").region).toBe("US"); // number decides when it is valid
  });

  it("recovers the typed part from a stored value", () => {
    expect(textoNacional("+573005550100", "CO")).toBe("3005550100");
    expect(textoNacional("+13005550100", "US")).toBe("3005550100");
    expect(textoNacional("+57123", "CO")).toBe("123");
    expect(textoNacional("", "CO")).toBe("");
  });
});
