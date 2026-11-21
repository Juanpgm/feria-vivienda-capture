import { describe, expect, it } from "vitest";
import type { Apu } from "../domain/apus";
import { opcionesApus } from "./armado";
import { arbolApus, buscarEnArbol, rutaApu } from "./arbolApus";

const apu = (item: string, descripcion: string, capitulo: string, subcapitulo?: string, subcapitulo_nombre?: string): Apu => ({
  item,
  descripcion,
  und: "M2",
  costo_unitario: 1000,
  capitulo,
  capitulo_nombre: `Cap ${capitulo}`,
  ...(subcapitulo && { subcapitulo, subcapitulo_nombre: subcapitulo_nombre ?? `Sub ${subcapitulo}` }),
});

const apus = [
  apu("SIM01", "Tubería", "SIM", "SIM", "Cap SIM"),
  apu("APU 01", "Muro en ladrillo", "SVSH", "SVSH", "Cap SVSH"),
  apu("ME0101", "Mortero 1:3", "ME", "ME01"),
  apu("010101", "Localización", "01", "0101"),
  apu("200201", "Piso en tableta", "20", "2002"),
  apu("200102", "Placa de contrapiso", "20", "2001", "Bases-placas-andenes"),
  apu("200101", "ALISTADO PISO 4 CM", "20", "2001", "Bases-placas-andenes"),
  apu("110101", "Excavación manual", "11", "1101"),
  apu("990101", "Sin subcapítulo (importación vieja)", "99"),
];

describe("arbolApus", () => {
  const arbol = arbolApus(apus);

  it("orders trade chapters 10+ first, then 01-09, ME, SVSH, SIM", () => {
    expect(arbol.map((c) => c.codigo)).toEqual(["11", "20", "99", "01", "ME", "SVSH", "SIM"]);
  });

  it("groups items by subchapter, ordered by code, with counts", () => {
    const pisos = arbol.find((c) => c.codigo === "20")!;
    expect(pisos).toMatchObject({ nombre: "Cap 20", cantidad: 3 });
    expect(pisos.subcapitulos.map((s) => [s.codigo, s.nombre, s.cantidad])).toEqual([
      ["2001", "Bases-placas-andenes", 2],
      ["2002", "Sub 2002", 1],
    ]);
    expect(pisos.subcapitulos[0].items.map((a) => a.item)).toEqual(["200101", "200102"]);
  });

  it("falls back to the chapter when an APU has no subchapter", () => {
    const viejo = arbol.find((c) => c.codigo === "99")!;
    expect(viejo.subcapitulos.map((s) => [s.codigo, s.nombre])).toEqual([["99", "Cap 99"]]);
  });
});

describe("rutaApu", () => {
  it("names chapter and subchapter, skipping the subchapter when it is the chapter", () => {
    expect(rutaApu(apus[6])).toBe("20 Cap 20 › 2001 Bases-placas-andenes");
    expect(rutaApu(apus[1])).toBe("SVSH Cap SVSH");
    expect(rutaApu(apus[8])).toBe("99 Cap 99");
  });
});

describe("buscarEnArbol", () => {
  const opciones = opcionesApus(apus);
  const items = (r: Apu[]) => r.map((a) => a.item);

  it("searches every item by ITEM prefix or accent-insensitive words", () => {
    expect(items(buscarEnArbol(opciones, "2001"))).toEqual(["200102", "200101"]);
    expect(items(buscarEnArbol(opciones, "excavacion"))).toEqual(["110101"]);
    expect(items(buscarEnArbol(opciones, "piso"))).toEqual(["200201", "200101", "200102"]);
  });

  it("searches only within a chapter or a subchapter", () => {
    expect(items(buscarEnArbol(opciones, "piso", { capitulo: "20", subcapitulo: "2001" }))).toEqual(["200101", "200102"]);
    expect(items(buscarEnArbol(opciones, "placa", { capitulo: "20" }))).toEqual(["200102"]);
    expect(items(buscarEnArbol(opciones, "placa", { capitulo: "11" }))).toEqual([]);
  });

  it("needs 2 characters", () => {
    expect(buscarEnArbol(opciones, "p")).toEqual([]);
  });
});
