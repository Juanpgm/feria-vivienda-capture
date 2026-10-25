import { describe, expect, it } from "vitest";
import { aligerar, bytesDeDataUrl, elegirExportacion, extension, firmaVacia, longitudTotal, MAX_FIRMA_BYTES, PLAN_EXPORTACION, puntoMedio, type Trazo } from "./lienzo";

const linea = (x0: number, y0: number, x1: number, y1: number, n = 20): Trazo =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n }));

describe("firmaVacia (empty / trivial detection)", () => {
  it("no strokes, a tap and a dot are empty", () => {
    expect(firmaVacia([])).toBe(true);
    expect(firmaVacia([[{ x: 10, y: 10 }]])).toBe(true);
    expect(firmaVacia([[{ x: 10, y: 10 }, { x: 10.5, y: 10.5 }]])).toBe(true);
  });

  it("a short scratch is empty, a real stroke is not", () => {
    expect(firmaVacia([linea(0, 0, 30, 0)])).toBe(true); // shorter than the minimum ink
    expect(firmaVacia([linea(0, 0, 200, 40)])).toBe(false);
  });

  it("long ink packed in a tiny area (scribbling in place) is still empty", () => {
    const garabato: Trazo = Array.from({ length: 200 }, (_, i) => ({ x: 5 + (i % 2) * 6, y: 5 + (i % 3) }));
    expect(longitudTotal([garabato])).toBeGreaterThan(80);
    expect(firmaVacia([garabato])).toBe(true);
  });

  it("several short strokes that add up to enough ink and extent count", () => {
    expect(firmaVacia([linea(0, 0, 50, 0), linea(60, 0, 110, 20)])).toBe(false);
  });
});

describe("geometry helpers", () => {
  it("extension and midpoints", () => {
    expect(extension([])).toEqual({ ancho: 0, alto: 0 });
    expect(extension([linea(10, 20, 60, 30)])).toEqual({ ancho: 50, alto: 10 });
    expect(puntoMedio({ x: 0, y: 0 }, { x: 4, y: 2 })).toEqual({ x: 2, y: 1 });
  });

  it("aligerar drops jitter but keeps the first and last point", () => {
    const t: Trazo = [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.2, y: 0 }, { x: 5, y: 0 }, { x: 5.1, y: 0 }, { x: 9, y: 0 }];
    const r = aligerar(t);
    expect(r[0]).toEqual(t[0]);
    expect(r.at(-1)).toEqual(t.at(-1));
    expect(r.length).toBeLessThan(t.length);
    expect(aligerar([t[0], t[1]])).toHaveLength(2);
  });
});

describe("export plan (<= 100 KB)", () => {
  const url = (mime: string, bytes: number) => `data:${mime};base64,${"A".repeat(Math.ceil((bytes * 4) / 3))}`;

  it("measures the payload of a data URL", () => {
    expect(bytesDeDataUrl("data:image/png;base64,AAAA")).toBe(3);
    expect(bytesDeDataUrl("data:image/png;base64,AA==")).toBe(1);
  });

  it("takes the first attempt that fits, trying smaller scales when too big", () => {
    const intentos: number[] = [];
    const r = elegirExportacion((e) => {
      intentos.push(e.escala);
      return url(e.mime, e.escala === 1 ? MAX_FIRMA_BYTES + 5000 : 20_000);
    });
    expect(r).not.toBeNull();
    expect(intentos).toEqual([1, 0.75]);
  });

  it("skips attempts the browser did not honor (wrong mime) and returns null when nothing fits", () => {
    expect(elegirExportacion((e) => url("image/png", 10).replace("image/png", e.mime === "image/png" ? "image/png" : "image/png"))).not.toBeNull();
    expect(elegirExportacion(() => url("image/png", MAX_FIRMA_BYTES * 3))).toBeNull();
    const vistos: string[] = [];
    elegirExportacion((e) => (vistos.push(e.mime), "data:image/png;base64,AAAA".replace("image/png", "image/gif")));
    expect(vistos.length).toBe(PLAN_EXPORTACION.length);
  });
});
