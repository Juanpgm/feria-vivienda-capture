import { describe, expect, it } from "vitest";
import { construirApus, normalizarItem, normalizarUnidad } from "./apus";

const hoja = [
  [null, null, null, null, null],
  ["LISTADO DE PRECIOS DE REFERENCIA", null, null, null, null],
  ["ITEM", "DESCRIPCION", "UND", "COSTO UNITARIO", null],
  ["ME", "SUBMEZCLAS", null, null, null],
  ["ME01", "CONCRETOS", null, null, null],
  ["ME0101", "MEZCLA CONCRETO 1:2:1  4000  PSI", "M3", 554912, null],
  ["01", "OBRAS URBANISTICAS", null, null, null],
  ["0101", "ACTIVIDADES PRELIMINARES", null, null, null],
  [10101, "LOCALIZACION Y REPLANTEO", "m2", 3500, null],
  [8.68, "MUROS DE TIERRA ESTABILIZADA MECÁNICAMENTE", null, null, null],
  [29, "PINTURA", null, null, null],
  [2903, "VINILOS", null, null, null],
  [290304, "  ESTUCO Y PINTURA  VINILO ", "M2", 21000.4, null],
  [8, "INFRAESTRUCTURA VIAL", null, null, null],
  [8.2, "EXPLANACIONES", null, null, null],
  [8.2, "DESMONTE Y LIMPIEZA", null, null, null],
  [8.201, "DEMOLICIÓN Y REMOCIÓN", null, null, null],
  [82002, "DESMONTE EN ZONA NO BOSCOSA", "HA", 900000, null],
  [240201, "DIVISION ALUM.-ACRILICO", "M2", 315438, null],
  [240201, "DIV.ALUM.-ACRILICO (repetido)", "M2", 315438, "APU 85"],
  ["SVSH", "APUS UTILIZADOS EN PROCESOS ANTERIORES SVSH - SMIL", null, null, null],
  ["APU  01", "ACARREO EN LADERA", "M3 - KM", 69770, "INP 2"],
  [null, "SECRETARIA DE INFRAESTRUCTURA MUNICIPAL", null, null, null],
  [36, "RETIRO DE RESIDUOS", "M3", 61609, null],
  [290305, "SIN PRECIO", "M2", "N/A", null],
];

describe("normalizarItem", () => {
  it("restores the leading zero Excel dropped on chapters 01-09 and tidies text codes", () => {
    expect(normalizarItem(10101)).toBe("010101");
    expect(normalizarItem(290304)).toBe("290304");
    expect(normalizarItem("APU  01")).toBe("APU 01");
    expect(normalizarItem(" me0101 ")).toBe("ME0101");
    expect(normalizarItem(36)).toBe("36");
    expect(normalizarItem(null)).toBe("");
  });
});

describe("normalizarUnidad", () => {
  it("upper-cases and unifies spelling variants", () => {
    expect(normalizarUnidad("m2")).toBe("M2");
    expect(normalizarUnidad("M3 - KM")).toBe("M3-KM");
    expect(normalizarUnidad("M3K")).toBe("M3-KM");
    expect(normalizarUnidad("PTO")).toBe("PUNTO");
    expect(normalizarUnidad("h")).toBe("H");
  });
});

describe("construirApus", () => {
  const r = construirApus(hoja);

  it("keeps only priced rows, skipping title, header and chapter rows", () => {
    expect(r.apus.map((a) => a.item)).toEqual(["ME0101", "010101", "290304", "082002", "240201", "APU 01", "36"]);
  });

  it("maps ITEM, DESCRIPCION, UND and COSTO UNITARIO, rounding the price to whole pesos", () => {
    expect(r.apus.find((a) => a.item === "290304")).toEqual({
      item: "290304",
      descripcion: "ESTUCO Y PINTURA VINILO",
      und: "M2",
      costo_unitario: 21000,
      capitulo: "29",
      capitulo_nombre: "PINTURA",
      subcapitulo: "2903",
      subcapitulo_nombre: "VINILOS",
    });
  });

  it("assigns chapters from the code, with SVSH APUs and the infrastructure list grouped apart", () => {
    const cap = Object.fromEntries(r.apus.map((a) => [a.item, a.capitulo]));
    expect(cap).toMatchObject({ ME0101: "ME", "010101": "01", "APU 01": "SVSH", "36": "SIM" });
    expect(r.apus.find((a) => a.item === "010101")?.capitulo_nombre).toBe("OBRAS URBANISTICAS");
    expect(r.apus.find((a) => a.item === "APU 01")).toMatchObject({ capitulo_nombre: "APUS UTILIZADOS EN PROCESOS ANTERIORES SVSH - SMIL", fuente: "INP 2" });
  });

  it("first occurrence wins on a repeated ITEM; repeats and unpriced rows are reported", () => {
    expect(r.apus.find((a) => a.item === "240201")?.descripcion).toBe("DIVISION ALUM.-ACRILICO");
    expect(r.duplicados).toEqual(["240201"]);
    expect(r.omitidas).toEqual(["290305"]);
  });
});

describe("subcapítulos (chapter > subchapter > item hierarchy of LISTADO DE PRECIOS)", () => {
  const r = construirApus(hoja);
  const sub = (item: string) => r.apus.find((a) => a.item === item);

  it("takes the subchapter from the first 4 characters of the code, named by its header row", () => {
    expect(sub("ME0101")).toMatchObject({ subcapitulo: "ME01", subcapitulo_nombre: "CONCRETOS" });
    expect(sub("010101")).toMatchObject({ subcapitulo: "0101", subcapitulo_nombre: "ACTIVIDADES PRELIMINARES" });
  });

  it("reads decimal headers of chapter 08 (8.2 -> 0820), the last header with that code wins, deeper levels are ignored", () => {
    expect(sub("082002")).toMatchObject({ capitulo: "08", subcapitulo: "0820", subcapitulo_nombre: "DESMONTE Y LIMPIEZA" });
  });

  it("an item without a named subchapter header gets a generic name", () => {
    expect(sub("240201")).toMatchObject({ subcapitulo: "2402", subcapitulo_nombre: "Subcapítulo 2402" });
  });

  it("lists without subchapters (SVSH APUs, SIM) use the chapter itself as their only subchapter", () => {
    expect(sub("APU 01")).toMatchObject({ subcapitulo: "SVSH", subcapitulo_nombre: "APUS UTILIZADOS EN PROCESOS ANTERIORES SVSH - SMIL" });
    expect(sub("36")).toMatchObject({ subcapitulo: "SIM", subcapitulo_nombre: "SECRETARIA DE INFRAESTRUCTURA MUNICIPAL" });
  });
});

