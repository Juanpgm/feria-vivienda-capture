import { describe, expect, it } from "vitest";
import type { Apu } from "../domain/apus";
import type { Capitulo } from "./armado";
import {
  agregarCategoria,
  agregarExtra,
  capituloPorDefecto,
  categoriaDeApu,
  fueraDeAplica,
  nombreCategoria,
  quitarCapitulo,
  SIN_CATEGORIAS,
  sincronizarCapitulos,
} from "./capitulosAuto";

const fila = (id: string) => ({ id, item: "200101", cantidad_expr: "1" });
const vista = (c: Capitulo[]) => c.map((x) => [x.id, x.nombre, x.filas.length]);

describe("nombreCategoria", () => {
  it("names the categories like the PRESUPUESTO TOPOP chapters", () => {
    expect((["piso", "bano", "cocina", "alcantarillado_piso", "acabado_muros", "espacio_3x3", "cubierta"] as const).map(nombreCategoria)).toEqual([
      "PISO", "BAÑO", "COCINA", "ALCANTARILLADO Y PISO", "ACABADO MUROS", "ESPACIO 3X3", "CUBIERTA",
    ]);
  });
});

describe("sincronizarCapitulos", () => {
  it("creates one chapter per selected category, in APLICA_PARA order, with stable ids", () => {
    expect(vista(sincronizarCapitulos(["cocina", "piso"], []))).toEqual([["ap-piso", "PISO", 0], ["ap-cocina", "COCINA", 0]]);
  });

  it("adds the chapter of a new category and drops an empty one no longer selected", () => {
    const antes = sincronizarCapitulos(["piso", "bano"], []);
    expect(vista(sincronizarCapitulos(["bano", "cocina"], antes))).toEqual([["ap-bano", "BAÑO", 0], ["ap-cocina", "COCINA", 0]]);
  });

  it("keeps a deselected category chapter that has rows, flagged as not in Sí, para", () => {
    const antes = [{ id: "ap-piso", nombre: "PISO", filas: [fila("f1")] }];
    const despues = sincronizarCapitulos(["bano"], antes);
    expect(vista(despues)).toEqual([["ap-piso", "PISO", 1], ["ap-bano", "BAÑO", 0]]);
    expect(despues.map((c) => fueraDeAplica(c, ["bano"]))).toEqual([true, false]);
  });

  it("maps old chapters by name to their category and keeps the others as extra chapters", () => {
    const antes = [
      { id: "u1", nombre: "Preliminares", filas: [] },
      { id: "u2", nombre: "PISOS", filas: [fila("f1")] },
      { id: "u3", nombre: "Pisos segundo nivel", filas: [fila("f2")] },
    ];
    expect(vista(sincronizarCapitulos(["piso"], antes))).toEqual([["ap-piso", "PISO", 1], ["u1", "Preliminares", 0], ["u3", "Pisos segundo nivel", 1]]);
  });

  it("is stable when nothing changes", () => {
    const una = sincronizarCapitulos(["piso", "bano"], [{ id: "x", nombre: "Otros", filas: [] }]);
    expect(sincronizarCapitulos(["piso", "bano"], una)).toEqual(una);
  });
});

describe("agregarCategoria / agregarExtra", () => {
  it("adding a category chapter also marks it in Sí, para", () => {
    const r = agregarCategoria({ aplicaPara: ["cocina"], capitulos: sincronizarCapitulos(["cocina"], []) }, "piso");
    expect(r.aplicaPara).toEqual(["piso", "cocina"]);
    expect(vista(r.capitulos)).toEqual([["ap-piso", "PISO", 0], ["ap-cocina", "COCINA", 0]]);
  });

  it("a free-name chapter goes last and leaves Sí, para alone", () => {
    const r = agregarExtra({ aplicaPara: ["piso"], capitulos: sincronizarCapitulos(["piso"], []) }, "  Preliminares ", "n1");
    expect(r.aplicaPara).toEqual(["piso"]);
    expect(r.id).toBe("n1");
    expect(vista(r.capitulos)).toEqual([["ap-piso", "PISO", 0], ["n1", "Preliminares", 0]]);
  });

  it("a free name of a category without its chapter adds that category", () => {
    const r = agregarExtra({ aplicaPara: ["piso"], capitulos: sincronizarCapitulos(["piso"], []) }, "cocina", "n1");
    expect(r.aplicaPara).toEqual(["piso", "cocina"]);
    expect(r.id).toBe("ap-cocina");
  });
});

describe("quitarCapitulo", () => {
  const p = { aplicaPara: ["piso", "bano"], capitulos: [...sincronizarCapitulos(["piso", "bano"], []), { id: "n1", nombre: "Otros", filas: [] }] };

  it("removing a category chapter unmarks it in Sí, para", () => {
    const r = quitarCapitulo(p, "ap-bano");
    expect(r).toEqual({ aplicaPara: ["piso"], capitulos: [p.capitulos[0], p.capitulos[2]] });
  });

  it("removing an extra chapter leaves Sí, para alone", () => {
    expect(quitarCapitulo(p, "n1")).toEqual({ aplicaPara: ["piso", "bano"], capitulos: p.capitulos.slice(0, 2) });
  });

  it("refuses to leave Sí, para empty", () => {
    const uno = { aplicaPara: ["piso"], capitulos: sincronizarCapitulos(["piso"], []) };
    expect(quitarCapitulo(uno, "ap-piso")).toEqual({ error: SIN_CATEGORIAS });
  });

  it("a flagged chapter (category not in Sí, para) is removed without touching Sí, para", () => {
    const q = { aplicaPara: ["bano"], capitulos: sincronizarCapitulos(["bano"], [{ id: "ap-piso", nombre: "PISO", filas: [fila("f1")] }]) };
    expect(quitarCapitulo(q, "ap-piso")).toEqual({ aplicaPara: ["bano"], capitulos: [q.capitulos[1]] });
  });
});

const apu = (capitulo_nombre: string, subcapitulo_nombre?: string): Apu => ({ item: "x", descripcion: "x", und: "M2", costo_unitario: 1, capitulo: "20", capitulo_nombre, subcapitulo_nombre });

describe("categoriaDeApu / capituloPorDefecto", () => {
  it("maps obvious price-list chapters to their category", () => {
    expect(categoriaDeApu(apu("PISOS", "Bases-placas-andenes"))).toBe("piso");
    expect(categoriaDeApu(apu("EQUIPAMIENTO BAÑOS"))).toBe("bano");
    expect(categoriaDeApu(apu("MUEBLES", "Mesones de cocina"))).toBe("cocina");
    expect(categoriaDeApu(apu("PRELIMINARES"))).toBeUndefined();
  });

  it("is undefined when two categories match", () => {
    expect(categoriaDeApu(apu("PISOS Y ENCHAPES DE BAÑO"))).toBeUndefined();
  });

  const caps = sincronizarCapitulos(["piso", "bano"], [{ id: "n1", nombre: "Otros", filas: [] }]);
  it("defaults to the category chapter, else the last chapter used, else the first", () => {
    expect(capituloPorDefecto(apu("EQUIPAMIENTO BAÑOS"), caps, "n1")).toBe("ap-bano");
    expect(capituloPorDefecto(apu("CUBIERTAS"), caps, "n1")).toBe("n1");
    expect(capituloPorDefecto(apu("PRELIMINARES"), caps, "borrado")).toBe("ap-piso");
  });
});
