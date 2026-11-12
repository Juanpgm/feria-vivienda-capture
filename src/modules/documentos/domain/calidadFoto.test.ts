import { describe, expect, it } from "vitest";
import { distanciaHuella, evaluarCedula, huella, metricas, type Pixeles } from "./calidadFoto";

const imagen = (w: number, h: number, f: (x: number, y: number) => number): Pixeles => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = f(x, y);
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  return { data, width: w, height: h };
};

// Card-like: light background with dark "text" bars of varied widths and a dark "portrait" block.
const carta = imagen(480, 300, (x, y) => ((y % 18 < 6 && x > 160 && ((x >> 3) + (y >> 4)) % 3 !== 0) || (x < 140 && y > 60 && y < 220) ? 40 : 215));
const plana = imagen(480, 300, () => 150);
const oscura = imagen(480, 300, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? 30 : 10));

describe("evaluarCedula", () => {
  it("accepts a sharp, textured, horizontal image", () => expect(evaluarCedula(metricas(carta), 480, 300)).toEqual({ ok: true }));
  it("rejects a flat image as not a document", () => {
    const r = evaluarCedula(metricas(plana), 480, 300);
    expect(r.ok).toBe(false);
  });
  it("rejects dark, vertical and blurry images with a specific message", () => {
    expect(evaluarCedula(metricas(oscura), 480, 300)).toMatchObject({ ok: false, mensaje: expect.stringContaining("oscura") });
    expect(evaluarCedula(metricas(carta), 300, 480)).toEqual({ ok: true }); // portrait phone photos are normal
    expect(evaluarCedula(metricas(carta), 1500, 300)).toMatchObject({ ok: false, mensaje: expect.stringContaining("alargada") });
    const borrosa = { ...metricas(carta), nitidez: 5 };
    expect(evaluarCedula(borrosa, 480, 300)).toMatchObject({ ok: false, mensaje: expect.stringContaining("borrosa") });
  });
});

describe("huella", () => {
  it("is stable for the same image and far for a different one", () => {
    const otra = imagen(480, 300, (x) => (x < 240 ? 20 : 230));
    expect(distanciaHuella(huella(carta), huella(carta))).toBe(0);
    expect(distanciaHuella(huella(carta), huella(otra))).toBeGreaterThan(6);
  });
});
