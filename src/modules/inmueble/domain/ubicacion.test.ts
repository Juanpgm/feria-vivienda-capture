import { describe, expect, it } from "vitest";
import { detectarBarrio, estratoDeBarrio } from "./ubicacion";

describe("detectarBarrio", () => {
  it("finds the barrio named after the house number, ignoring accents and case", () => {
    expect(detectarBarrio("Av 5 Norte # 5N-02, Barrio Centenario")).toMatchObject({ nombre: "Centenario", codigo_division: "02" });
    expect(detectarBarrio("calle 10 # 4-15 TERRÓN COLORADO")).toMatchObject({ id: "0101" });
  });
  it("returns null when no barrio is named", () => {
    expect(detectarBarrio("Calle 12 # 5-20 apto 301")).toBeNull();
    expect(detectarBarrio("")).toBeNull();
  });
  it("does not take street names before the # as the barrio", () => {
    expect(detectarBarrio("Calle Centenario # 5-20")).toBeNull();
  });
});

describe("estratoDeBarrio", () => {
  it("gives the official estrato moda of a barrio and null otherwise", () => {
    expect(estratoDeBarrio("0206")).toBe(5);
    expect(estratoDeBarrio("V5611")).toBeNull();
    expect(estratoDeBarrio(null)).toBeNull();
  });
});
