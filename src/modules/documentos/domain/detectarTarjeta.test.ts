import { describe, expect, it } from "vitest";
import { detectarTarjeta, RELACION_TARJETA, type Rect } from "./detectarTarjeta";

const W = 240;
const H = 135;

/** Background + (optional) card with text bars and a portrait block. Seeded noise keeps it from being too clean. */
function escena(card: Rect | null, fondo = 95, tarjeta = 205) {
  const data = new Uint8ClampedArray(W * H * 4);
  let seed = 7;
  const ruido = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 9) - 4;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = fondo;
      if (card && x >= card.x && x < card.x + card.w && y >= card.y && y < card.y + card.h) {
        v = tarjeta;
        const rx = (x - card.x) / card.w;
        const ry = (y - card.y) / card.h;
        if (rx < 0.3 && ry > 0.25 && ry < 0.85) v = 120; // portrait
        else if (rx > 0.38 && rx < 0.92 && Math.floor(ry * 20) % 3 === 0 && ry > 0.15 && ry < 0.9) v = 60; // text lines
      }
      data.set([v + ruido(), v + ruido(), v + ruido(), 255], (y * W + x) * 4);
    }
  return data;
}

const guia: Rect = (() => {
  const w = W * 0.62;
  return { x: (W - w) / 2, y: (H - w / RELACION_TARJETA) / 2, w, h: w / RELACION_TARJETA };
})();

const iou = (a: Rect, b: Rect) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const i = ix * iy;
  return i / (a.w * a.h + b.w * b.h - i);
};

describe("detectarTarjeta", () => {
  it("finds a card that fills the guide", () => {
    const d = detectarTarjeta(escena(guia), W, H, guia);
    expect(d).not.toBeNull();
    expect(iou(d!.rect, guia)).toBeGreaterThan(0.8);
  });
  it("finds a card that is smaller and off-centre, and a dark card on a light table", () => {
    const c: Rect = { x: 60, y: 30, w: 100, h: 100 / RELACION_TARJETA };
    const d = detectarTarjeta(escena(c), W, H, guia);
    expect(d && iou(d.rect, c)).toBeGreaterThan(0.7);
    const oscura = detectarTarjeta(escena(guia, 200, 80), W, H, guia);
    expect(oscura && iou(oscura.rect, guia)).toBeGreaterThan(0.8);
  });
  it("finds a card held vertically", () => {
    const v: Rect = { x: 90, y: 15, w: 60 , h: 60 * RELACION_TARJETA };
    const d = detectarTarjeta(escena(v), W, H, guia);
    expect(d && iou(d.rect, v)).toBeGreaterThan(0.7);
  });
  it("does not detect anything in an empty scene or on a flat card", () => {
    expect(detectarTarjeta(escena(null), W, H, guia)).toBeNull();
    expect(detectarTarjeta(escena(guia, 128, 128), W, H, guia)).toBeNull();
  });
});
