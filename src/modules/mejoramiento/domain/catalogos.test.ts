import { describe, expect, it } from "vitest";
import { aplicaDeCapitulo, DETALLES_OPCIONALES, ELEMENTOS_VIVIENDA, elementosEnfocados, ESTADOS_ELEMENTO } from "./catalogos";

const claves = (s: readonly { clave: string }[]) => s.map((x) => x.clave);

describe("ELEMENTOS_VIVIENDA (Estado de la vivienda)", () => {
  it("is one flat list grouped Acabados, Instalaciones, Cocina, Baño, Estructura, rated Bueno/Regular/Malo/No existe", () => {
    expect(ESTADOS_ELEMENTO).toEqual({ b: "Bueno", r: "Regular", m: "Malo", ne: "No existe" });
    expect([...new Set(ELEMENTOS_VIVIENDA.map((e) => e.grupo))]).toEqual(["Acabados", "Instalaciones", "Cocina", "Baño", "Estructura"]);
    expect(claves(ELEMENTOS_VIVIENDA)).toEqual([
      "repello", "estuco_pintura", "fachada",
      "sanitarias", "hidraulicas", "electricas",
      "cocina_enchape", "cocina_meson", "cocina_lavaplatos",
      "bano_enchape", "bano_sanitario", "bano_lavamanos",
      "cubierta", "piso", "escaleras",
    ]);
  });

  it("optional details have unique keys", () => {
    const todas = DETALLES_OPCIONALES.flatMap((g) => claves(g.preguntas));
    expect(new Set(todas).size).toBe(todas.length);
    expect(todas).toEqual(expect.arrayContaining(["cubierta_material", "piso_material", "pozo_septico", "puertas_internas", "desmonte_otros"]));
  });
});

describe("elementosEnfocados (Estado enfocado)", () => {
  it("puts the elements of the selected improvements first, in list order and without duplicates", () => {
    const { relevantes, otras } = elementosEnfocados(["cocina", "bano"]);
    const esperadas = ["sanitarias", "hidraulicas", "cocina_enchape", "cocina_meson", "cocina_lavaplatos", "bano_enchape", "bano_sanitario", "bano_lavamanos"];
    expect(claves(relevantes)).toEqual(esperadas);
    expect(claves(otras)).toEqual(claves(ELEMENTOS_VIVIENDA).filter((c) => !esperadas.includes(c)));
  });

  it("maps every improvement to its elements", () => {
    expect(claves(elementosEnfocados(["piso"]).relevantes)).toEqual(["piso"]);
    expect(claves(elementosEnfocados(["acabado_muros"]).relevantes)).toEqual(["repello", "estuco_pintura", "fachada"]);
    expect(claves(elementosEnfocados(["espacio_3x3"]).relevantes)).toEqual(["repello", "electricas", "cubierta", "piso"]);
    expect(claves(elementosEnfocados(["alcantarillado_piso"]).relevantes)).toEqual(["sanitarias", "piso"]);
    expect(claves(elementosEnfocados(["cubierta"]).relevantes)).toEqual(["cubierta"]);
  });

  it("with nothing selected (or an unknown key) every element is in `otras`", () => {
    for (const lista of [[], ["desconocida"]]) {
      const { relevantes, otras } = elementosEnfocados(lista);
      expect(relevantes).toEqual([]);
      expect(claves(otras)).toEqual(claves(ELEMENTOS_VIVIENDA));
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
