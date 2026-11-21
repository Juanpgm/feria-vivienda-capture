import { describe, expect, it } from "vitest";
import { aplicaDeCapitulo, SECCIONES, seccionesEnfocadas } from "./catalogos";

const claves = (s: { clave: string }[]) => s.map((x) => x.clave);

describe("seccionesEnfocadas (Estado enfocado)", () => {
  it("puts the blocks of the selected improvements first, in SECCIONES order and without duplicates", () => {
    const { relevantes, otras } = seccionesEnfocadas(["cocina", "bano"]);
    expect(claves(relevantes)).toEqual(["sanitarias", "hidraulicas", "cocina", "bano"]);
    expect(claves(otras)).toEqual(claves(SECCIONES).filter((c) => !["sanitarias", "hidraulicas", "cocina", "bano"].includes(c)));
  });

  it("maps every improvement to its blocks", () => {
    expect(claves(seccionesEnfocadas(["piso"]).relevantes)).toEqual(["desmonte", "piso"]);
    expect(claves(seccionesEnfocadas(["acabado_muros"]).relevantes)).toEqual(["repello", "estuco_pintura", "fachada"]);
    expect(claves(seccionesEnfocadas(["espacio_3x3"]).relevantes)).toEqual(["repello", "electricas", "cubierta", "piso"]);
    expect(claves(seccionesEnfocadas(["alcantarillado_piso"]).relevantes)).toEqual(["sanitarias", "desmonte", "piso"]);
    expect(claves(seccionesEnfocadas(["cubierta"]).relevantes)).toEqual(["cubierta"]);
  });

  it("with nothing selected (or an unknown key) every block is in `otras`", () => {
    for (const lista of [[], ["desconocida"]]) {
      const { relevantes, otras } = seccionesEnfocadas(lista);
      expect(relevantes).toEqual([]);
      expect(claves(otras)).toEqual(claves(SECCIONES));
    }
  });
});

describe("aplicaDeCapitulo", () => {
  it("matches a chapter name to its improvement, accent and case insensitive", () => {
    expect(aplicaDeCapitulo("Baño")).toBe("bano");
    expect(aplicaDeCapitulo("  BANO principal ")).toBe("bano");
    expect(aplicaDeCapitulo("PISOS")).toBe("piso");
    expect(aplicaDeCapitulo("Alcantarillado y piso")).toBe("alcantarillado_piso");
    expect(aplicaDeCapitulo("Cocina")).toBe("cocina");
  });

  it("returns undefined for chapters that are not an improvement", () => {
    expect(aplicaDeCapitulo("Preliminares")).toBeUndefined();
    expect(aplicaDeCapitulo("")).toBeUndefined();
  });
});
