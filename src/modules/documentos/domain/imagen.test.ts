import { describe, expect, it } from "vitest";
import { comprimirHasta, detectarFormato, dimensionesFinales, errorDeFormato, formatoTamano, planDeCompresion } from "./imagen";

const con = (cabecera: number[] | string, desde = 0, b = new Uint8Array(32)) => {
  [...(typeof cabecera === "string" ? [...cabecera].map((c) => c.charCodeAt(0)) : cabecera)].forEach((v, i) => (b[desde + i] = v));
  return b;
};

describe("detectarFormato", () => {
  it("identifies formats by magic bytes", () => {
    expect(detectarFormato(con([0xff, 0xd8, 0xff, 0xe1]))).toBe("image/jpeg");
    expect(detectarFormato(con([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectarFormato(con("WEBP", 8, con("RIFF")))).toBe("image/webp");
    expect(detectarFormato(con("GIF89a"))).toBe("image/gif");
    expect(detectarFormato(con("heic", 8, con("ftyp", 4)))).toBe("image/heic");
  });

  it("returns null for text, PDFs and short buffers", () => {
    expect(detectarFormato(con("<html>"))).toBeNull();
    expect(detectarFormato(con("%PDF-1.7"))).toBeNull();
    expect(detectarFormato(new Uint8Array(4))).toBeNull();
  });
});

describe("dimensionesFinales", () => {
  it("downscales so the long side is at most 1600 and keeps the ratio", () => {
    expect(dimensionesFinales(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 });
    expect(dimensionesFinales(3000, 4000)).toEqual({ ancho: 1200, alto: 1600 });
  });
  it("never upscales and applies the extra scale", () => {
    expect(dimensionesFinales(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(dimensionesFinales(4000, 3000, 1600, 0.5)).toEqual({ ancho: 800, alto: 600 });
    expect(dimensionesFinales(1, 5000)).toEqual({ ancho: 1, alto: 1600 });
  });
});

describe("comprimirHasta", () => {
  it("plan goes from full size/best quality to smaller and lower", () => {
    const p = planDeCompresion();
    expect(p[0]).toEqual({ escala: 1, calidad: 0.85 });
    expect(p.at(-1)!.escala).toBeLessThan(1);
    expect(p.at(-1)!.calidad).toBeLessThan(p[0].calidad);
  });

  it("returns the first attempt that fits", async () => {
    const intentos: [number, number][] = [];
    const r = await comprimirHasta(async (e, c) => (intentos.push([e, c]), { size: c > 0.7 ? 900_000 : 600_000 }), 700_000);
    expect(r).toEqual({ size: 600_000 });
    expect(intentos).toEqual([[1, 0.85], [1, 0.75], [1, 0.65]]);
  });

  it("shrinks the dimensions when quality alone is not enough, and gives up with null", async () => {
    const r = await comprimirHasta(async (e) => ({ size: e < 0.7 ? 100 : 5_000_000 }), 700_000);
    expect(r).toEqual({ size: 100 });
    expect(await comprimirHasta(async () => ({ size: 5_000_000 }))).toBeNull();
    expect(await comprimirHasta(async () => null)).toBeNull();
  });
});

describe("mensajes", () => {
  it("formats sizes and explains rejected formats in Spanish", () => {
    expect(formatoTamano(512)).toBe("1 KB");
    expect(formatoTamano(250 * 1024)).toBe("250 KB");
    expect(formatoTamano(1.5 * 1024 * 1024)).toBe("1,5 MB");
    expect(errorDeFormato(null)).toMatch(/no es una imagen/);
    expect(errorDeFormato("image/heic")).toMatch(/HEIC/);
    expect(errorDeFormato("image/jpeg")).toBeNull();
  });
});
