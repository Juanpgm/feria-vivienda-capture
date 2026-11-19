import { describe, expect, it } from "vitest";
import { evaluarTinta } from "./firmaImagen";

/** w*h RGBA image: white background with `tinta` share of black pixels, or a uniform gray. */
function imagen(tinta: number, fondo = 255) {
  const n = 100 * 50;
  const d = new Uint8ClampedArray(n * 4).fill(fondo);
  for (let i = 0; i < Math.round(n * tinta); i++) d.set([0, 0, 0], i * 4);
  return d;
}

describe("evaluarTinta (uploaded signature image)", () => {
  it("accepts dark strokes on a light background", () => expect(evaluarTinta(imagen(0.05)).ok).toBe(true));
  it("rejects a blank image", () => expect(evaluarTinta(imagen(0)).ok).toBe(false));
  it("rejects a mostly dark image or a dark background (a photo, not a signature)", () => {
    expect(evaluarTinta(imagen(0.6)).ok).toBe(false);
    expect(evaluarTinta(imagen(0.05, 100)).ok).toBe(false);
  });
});
