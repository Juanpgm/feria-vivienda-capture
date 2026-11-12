import { describe, expect, it } from "vitest";
import { analizarTarjeta, RELACION_TARJETA, type Rect } from "./detectarTarjeta";

const W = 320;
const H = 180;

/** Background + (optional) card with text bars and a portrait block, slightly tilted. Seeded noise keeps it from being too clean. */
function escena(card: Rect | null, { fondo = 95, tarjeta = 205, giro = 0 }: { fondo?: number; tarjeta?: number; giro?: number } = {}) {
  const data = new Uint8ClampedArray(W * H * 4);
  let seed = 7;
  const ruido = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 9) - 4;
  const cx = card ? card.x + card.w / 2 : 0;
  const cy = card ? card.y + card.h / 2 : 0;
  const cos = Math.cos(giro);
  const sin = Math.sin(giro);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = fondo;
      if (card) {
        // inverse rotation into the card's own frame
        const lx = (x - cx) * cos + (y - cy) * sin + card.w / 2;
        const ly = -(x - cx) * sin + (y - cy) * cos + card.h / 2;
        if (lx >= 0 && lx < card.w && ly >= 0 && ly < card.h) {
          v = tarjeta;
          const rx = lx / card.w;
          const ry = ly / card.h;
          if (rx < 0.3 && ry > 0.25 && ry < 0.85) v = 120; // portrait
          else if (rx > 0.38 && rx < 0.92 && Math.floor(ry * 20) % 3 === 0 && ry > 0.15 && ry < 0.9) v = 60; // text lines
        }
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
const cardAt = (x: number, y: number, w: number): Rect => ({ x, y, w, h: w / RELACION_TARJETA });

describe("analizarTarjeta", () => {
  it("hugs the whole card: the refined contour matches it closely", () => {
    const c = cardAt(95, 40, 150); // off-centre and a different size than the guide
    const a = analizarTarjeta(escena(c), W, H, guia);
    expect(a.estado).toBe("completa");
    if (a.estado === "completa") expect(iou(a.rect, c)).toBeGreaterThan(0.9);
  });
  it("handles a card that fills the guide, a dark card on a light table and a slight tilt", () => {
    const a = analizarTarjeta(escena(guia), W, H, guia);
    expect(a.estado === "completa" && iou(a.rect, guia)).toBeGreaterThan(0.9);
    const oscura = analizarTarjeta(escena(guia, { fondo: 200, tarjeta: 80 }), W, H, guia);
    expect(oscura.estado === "completa" && iou(oscura.rect, guia)).toBeGreaterThan(0.9);
    const c = cardAt(90, 35, 150);
    const inclinada = analizarTarjeta(escena(c, { giro: 0.06 }), W, H, guia);
    expect(inclinada.estado === "completa" && iou(inclinada.rect, c)).toBeGreaterThan(0.8);
  });
  it("finds a card held vertically", () => {
    const v: Rect = { x: 130, y: 20, w: 70, h: 70 * RELACION_TARJETA };
    const a = analizarTarjeta(escena(v), W, H, guia);
    expect(a.estado === "completa" && iou(a.rect, v)).toBeGreaterThan(0.85);
  });
  it("does not accept a card that is cut by the image border, and says so", () => {
    const c = cardAt(180, 40, 150); // runs past the right border
    const a = analizarTarjeta(escena(c), W, H, guia);
    expect(a.estado).not.toBe("completa");
  });
  it("asks to come closer when the card is too small to read", () => {
    const a = analizarTarjeta(escena(cardAt(140, 70, 80)), W, H, guia);
    expect(a).toMatchObject({ estado: "ajustar", problema: "pequena" });
  });
  it("does not detect anything in an empty scene or on a flat card", () => {
    expect(analizarTarjeta(escena(null), W, H, guia).estado).toBe("ninguna");
    expect(analizarTarjeta(escena(guia, { fondo: 128, tarjeta: 128 }), W, H, guia).estado).toBe("ninguna");
  });
});
