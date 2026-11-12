import { describe, expect, it } from "vitest";
import { separarNombre } from "./nombre";

describe("separarNombre", () => {
  it("splits common shapes", () => {
    expect(separarNombre("AARON FELIPE QUINTERO RAMIREZ")).toEqual({ primer_nombre: "AARON", segundo_nombre: "FELIPE", primer_apellido: "QUINTERO", segundo_apellido: "RAMIREZ" });
    expect(separarNombre("ABELARDO VARGAS")).toMatchObject({ primer_nombre: "ABELARDO", primer_apellido: "VARGAS", segundo_apellido: "" });
    expect(separarNombre("ANA PEREZ GOMEZ")).toMatchObject({ primer_nombre: "ANA", segundo_nombre: "", primer_apellido: "PEREZ", segundo_apellido: "GOMEZ" });
  });
  it("keeps particles with the next word and never drops a word", () => {
    const r = separarNombre("MARIA DE LOS ANGELES DE LA CRUZ");
    expect(Object.values(r).filter(Boolean).join(" ")).toBe("MARIA DE LOS ANGELES DE LA CRUZ");
  });
});
