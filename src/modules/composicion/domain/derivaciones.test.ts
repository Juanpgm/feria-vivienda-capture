import { describe, expect, it } from "vitest";
import { bandaAdultoMayor, bandaHogar, calcularEdad } from "./derivaciones";

describe("bandaHogar", () => {
  it.each([[1, "1"], [2, "2_3"], [3, "2_3"], [4, "4_mas"], [9, "4_mas"]])("%d -> %s", (n, b) =>
    expect(bandaHogar(n)).toBe(b),
  );
});

describe("bandaAdultoMayor", () => {
  it.each([
    [[], "ninguno"],
    [[60, 64], "ninguno"],
    [[65], "65_73"],
    [[73], "65_73"],
    [[74], "65_73"], // PDF gap, documented
    [[75], "mayor_74"],
    [[66, 80], "mayor_74"],
  ])("%j -> %s", (edades, b) => expect(bandaAdultoMayor(edades)).toBe(b));
});

describe("calcularEdad", () => {
  it.each([
    ["2000-06-15", "2026-06-14", 25],
    ["2000-06-15", "2026-06-15", 26],
    ["2000-06-15", "2026-12-31", 26],
    ["2000-02-29", "2026-02-28", 25],
  ])("%s as of %s -> %d", (n, h, e) => expect(calcularEdad(n, h)).toBe(e));
});
