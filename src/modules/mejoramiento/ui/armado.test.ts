import { describe, expect, it } from "vitest";
import type { Apu } from "../domain/apus";
import { actividadesFrecuentes, buscarApus, capitulosSugeridos, conteosFotos, construirManifiesto, dataUrlAPng, erroresPaso, formatoCop, opcionesApus, valorFila, visitaVacia, type Valores } from "./armado";

const apu = (item: string, descripcion: string): Apu => ({ item, descripcion, und: "M2", costo_unitario: 1000, capitulo: "01", capitulo_nombre: "X" });

describe("buscarApus", () => {
  const opciones = opcionesApus([apu("240201", "EXCAVACIÓN MANUAL"), apu("APU 01", "Muro en ladrillo"), apu("110101", "Pañete liso")]);

  it("finds by description, accent and case insensitive", () => {
    expect(buscarApus(opciones, "excavacion").map((a) => a.item)).toEqual(["240201"]);
    expect(buscarApus(opciones, "PANETE").map((a) => a.item)).toEqual(["110101"]);
  });

  it("finds by ITEM code", () => {
    expect(buscarApus(opciones, "apu 01").map((a) => a.item)).toEqual(["APU 01"]);
    expect(buscarApus(opciones, "2402").map((a) => a.item)).toEqual(["240201"]);
  });

  it("returns nothing for a query shorter than 2 characters", () => {
    expect(buscarApus(opciones, " e ")).toEqual([]);
  });
});

const conFilas = (): Valores => {
  const v = visitaVacia("6f1c3f0e-6a34-4d53-9b77-2b2f1f6f0c11");
  v.capitulos = [
    { id: "c1", nombre: "Piso", filas: [{ id: "f1", item: "A", cantidad_expr: "1" }, { id: "f2", item: "A", cantidad_expr: "2" }] },
    { id: "c2", nombre: "Baño", filas: [{ id: "f3", item: "B", cantidad_expr: "3" }] },
  ];
  return v;
};

describe("conteosFotos", () => {
  it("counts photos per quantity row in order, 0 for rows without photos", () => {
    const v = conFilas();
    expect(conteosFotos(v.capitulos, { f1: [{ ref: "r1", mime: "image/jpeg", bytes: 1 }], f3: [] })).toEqual([1, 0, 0]);
  });
});

describe("construirManifiesto", () => {
  it("lists the photos of existing rows plus one PNG citizen signature, ignoring orphan photos", () => {
    const v = conFilas();
    const fotos = {
      f1: [{ ref: "r1", mime: "image/jpeg", bytes: 10 }],
      f3: [{ ref: "r2", mime: "image/webp", bytes: 20 }],
      borrada: [{ ref: "r9", mime: "image/jpeg", bytes: 5 }],
    };
    expect(construirManifiesto(v.capitulos, fotos, 30)).toEqual([
      { ref: "r1", tipo: "foto", fila_id: "f1", content_type: "image/jpeg", bytes: 10 },
      { ref: "r2", tipo: "foto", fila_id: "f3", content_type: "image/webp", bytes: 20 },
      { ref: "firma", tipo: "firma_ciudadano", content_type: "image/png", bytes: 30 },
    ]);
  });
});

describe("erroresPaso", () => {
  it("step 1 Anfitrión reports who attends AND the owner data, nothing else", () => {
    const e = erroresPaso(0, visitaVacia("6f1c3f0e-6a34-4d53-9b77-2b2f1f6f0c11"));
    expect(Object.keys(e).every((k) => k.startsWith("atiende.") || k.startsWith("propietario."))).toBe(true);
    expect(e["atiende.relacion"]).toBe("Seleccione una opción");
    expect(Object.keys(e).some((k) => k.startsWith("propietario."))).toBe(true);
  });

  it("asks for at least one activity in the Cantidades step (index 2) when the visit applies", () => {
    const v = visitaVacia("6f1c3f0e-6a34-4d53-9b77-2b2f1f6f0c11");
    v.atiende = { relacion: "propietario", nombre: "Ana María Pérez", documento: "12345678" };
    v.propietario = { nombre: "Ana María Pérez", tipo_documento: "cc", documento: "12345678", telefono: "3001234567", direccion: "Calle 5 # 10-20", anios_habitando: "3", personas: "2" };
    v.diagnostico = { aplica: "si", aplica_para: ["piso"], alcance: "tipo", estados: {}, detalles: {} };
    expect(erroresPaso(2, v)).toEqual({ capitulos: "Agregue al menos una actividad con su cantidad medida" });
  });
});

describe("formatoCop", () => {
  it("formats pesos without decimals", () => {
    expect(formatoCop(1234567.4).replace(/\s/g, " ")).toBe("$ 1.234.567");
  });
});

describe("dataUrlAPng", () => {
  it("decodes a PNG data URL into a Blob with its bytes", async () => {
    const b = dataUrlAPng("data:image/png;base64,iVBORw0K");
    expect(b.type).toBe("image/png");
    expect([...new Uint8Array(await b.arrayBuffer())]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  });

  it("rejects anything that is not a PNG data URL", () => {
    expect(() => dataUrlAPng("data:image/webp;base64,AAAA")).toThrow();
  });
});

describe("actividadesFrecuentes (Sugerencias de APU)", () => {
  const mapa = new Map(["100113", "310105", "200223", "190533", "250451"].map((i) => [i, apu(i, `APU ${i}`)]));
  const sugeridos = { comunes: ["100113", "310105", "APU 117"], por_capitulo: { piso: ["200223"], bano: ["190533", "250451", "999999"] } };

  it("offers the chapter's frequent items first, then the common ones, only if they are in the price list", () => {
    expect(actividadesFrecuentes("Baño", sugeridos, mapa, []).map((a) => a.item)).toEqual(["190533", "250451", "100113", "310105"]);
  });

  it("leaves out the items already in the chapter", () => {
    expect(actividadesFrecuentes("PISO", sugeridos, mapa, [{ id: "f", item: "200223", cantidad_expr: "" }]).map((a) => a.item)).toEqual(["100113", "310105"]);
  });

  it("offers only the common items for a chapter that is not an improvement", () => {
    expect(actividadesFrecuentes("Preliminares", sugeridos, mapa, []).map((a) => a.item)).toEqual(["100113", "310105"]);
  });
});

describe("capitulosSugeridos", () => {
  it("creates one chapter per selected improvement, with its label", () => {
    expect(capitulosSugeridos(["piso", "bano", "x"]).map((c) => [c.nombre, c.filas])).toEqual([["Piso", []], ["Baño", []]]);
  });
});

describe("valorFila (a row of the budget table)", () => {
  const a = { ...apu("200101", "ALISTADO PISO"), costo_unitario: 37857 };

  it("evaluates the expression and prices it with ROUNDUP, like PRECIO TOTAL", () => {
    expect(valorFila("(3,5*4)", a)).toEqual({ cantidad: 14, error: "", total: Math.ceil(14 * 37857) });
    expect(valorFila("0,333", a)).toEqual({ cantidad: 0.333, error: "", total: 12607 });
  });

  it("shows no error while the quantity is still empty", () => {
    expect(valorFila("  ", a)).toEqual({ cantidad: null, error: "", total: null });
  });

  it("returns the evaluarCantidad error of an invalid expression", () => {
    expect(valorFila("2*(3", a)).toEqual({ cantidad: null, error: "Revise la operación: 2*(3", total: null });
  });

  it("has no total when the ITEM is not in the price list", () => {
    expect(valorFila("2", undefined)).toEqual({ cantidad: 2, error: "", total: null });
  });
});
