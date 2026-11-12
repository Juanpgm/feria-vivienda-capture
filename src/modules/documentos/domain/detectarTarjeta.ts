// Live detection of an ID-1 card (85.6 x 54 mm, ratio 1.586) in a camera frame, with no ML and no dependency.
// The four sides of the card are looked for as step edges (inside vs outside of a candidate rectangle) in a small set
// of candidate rectangles around the guide; the card is "detected" when all four sides show a consistent edge of the
// same polarity (card lighter than the table, or darker, on every side) and the inside is not blank.
// It works on a downscaled luminance image so it can run several times per second on a phone.

export type Rect = { x: number; y: number; w: number; h: number };
export type Deteccion = { rect: Rect; puntaje: number };

export const RELACION_TARJETA = 1.586;

const CONTRASTE_MIN = 14; // luminance step (0-255) that counts as an edge
const LADO_MIN = 0.6; // share of sampled positions of a side that must show the edge
const DESVIACION_MIN = 10; // inside of the card is not a flat patch

type Gris = { g: Float32Array; w: number; h: number };

/** RGBA -> luminance. */
export function aGris(data: Uint8ClampedArray, w: number, h: number): Gris {
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return { g, w, h };
}

type Lado = { frac: number; signo: number; /** mean distance of the found edge to the nominal side, as a share of the band */ desvio: number };
const SIN_LADO: Lado = { frac: 0, signo: 0, desvio: 1 };

/**
 * One side of `r`. `vertical`: left/right side (scan rows); `dentro`: +1 when the inside lies at larger coordinates
 * (left and top sides), -1 otherwise. The edge is searched within +-`banda` pixels of the nominal position.
 */
function lado({ g, w, h }: Gris, r: Rect, vertical: boolean, fijo: number, dentro: 1 | -1, banda: number): Lado {
  const desde = vertical ? r.y + r.h * 0.12 : r.x + r.w * 0.12;
  const hasta = vertical ? r.y + r.h * 0.88 : r.x + r.w * 0.88;
  let total = 0;
  let con = 0;
  let suma = 0;
  let desvio = 0;
  for (let t = Math.round(desde); t <= hasta; t += 2) {
    let mejor = 0;
    let enP = fijo;
    for (let p = fijo - banda; p <= fijo + banda; p++) {
      const a = p + dentro * 2; // inside samples
      const b = p - dentro * 2; // outside samples
      const [ax, ay, bx, by] = vertical ? [a, t, b, t] : [t, a, t, b];
      if (ax < 0 || bx < 0 || ay < 0 || by < 0 || ax + 1 >= w || bx + 1 >= w || ay + 1 >= h || by + 1 >= h) return SIN_LADO;
      const dentroV = vertical ? (g[ay * w + ax] + g[ay * w + ax + dentro]) / 2 : (g[ay * w + ax] + g[(ay + dentro) * w + ax]) / 2;
      const fueraV = vertical ? (g[by * w + bx] + g[by * w + bx - dentro]) / 2 : (g[by * w + bx] + g[(by - dentro) * w + bx]) / 2;
      const d = dentroV - fueraV;
      if (Math.abs(d) > Math.abs(mejor)) {
        mejor = d;
        enP = p;
      }
    }
    total++;
    if (Math.abs(mejor) >= CONTRASTE_MIN) {
      con++;
      suma += Math.sign(mejor);
      desvio += Math.abs(enP - fijo) / banda;
    }
  }
  return total ? { frac: con / total, signo: Math.sign(suma), desvio: con ? desvio / con : 1 } : SIN_LADO;
}

function desviacion({ g, w }: Gris, r: Rect): number {
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = Math.round(r.y); y < r.y + r.h; y += 2)
    for (let x = Math.round(r.x); x < r.x + r.w; x += 2) {
      const v = g[y * w + x];
      s += v;
      s2 += v * v;
      n++;
    }
  return n ? Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) : 0;
}

function evaluar(img: Gris, r: Rect): number {
  const banda = Math.max(3, Math.round(Math.min(r.w, r.h) * 0.1));
  const lados = [
    lado(img, r, true, Math.round(r.x), 1, banda), // left
    lado(img, r, true, Math.round(r.x + r.w), -1, banda), // right
    lado(img, r, false, Math.round(r.y), 1, banda), // top
    lado(img, r, false, Math.round(r.y + r.h), -1, banda), // bottom
  ];
  if (lados.some((l) => l.frac < LADO_MIN || l.signo === 0)) return 0;
  if (lados.some((l) => l.signo !== lados[0].signo)) return 0; // same polarity on the four sides
  if (desviacion(img, r) < DESVIACION_MIN) return 0;
  // Tight fits win over loose ones: the edges must sit ON the candidate's sides.
  return lados.reduce((a, l) => a + l.frac * (1 - 0.6 * l.desvio), 0) / 4;
}

/**
 * Best card rectangle near `guia` (the frame drawn on screen), horizontal or vertical, or null. Candidates are the
 * guide scaled 0.5-1.4 and shifted up to +-12 % of the image.
 */
export function detectarTarjeta(data: Uint8ClampedArray, w: number, h: number, guia: Rect): Deteccion | null {
  const img = aGris(data, w, h);
  let mejor: Deteccion | null = null;
  for (const giro of [false, true]) {
    const base = giro ? { w: guia.h, h: guia.w } : { w: guia.w, h: guia.h };
    for (const s of [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4]) {
      const cw = base.w * s;
      const ch = base.h * s;
      const cx = guia.x + guia.w / 2;
      const cy = guia.y + guia.h / 2;
      for (const dx of [-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12]) {
        for (const dy of [-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12]) {
          const r = { x: cx - cw / 2 + dx * w, y: cy - ch / 2 + dy * h, w: cw, h: ch };
          if (r.x < 2 || r.y < 2 || r.x + r.w > w - 3 || r.y + r.h > h - 3) continue;
          const p = evaluar(img, r);
          if (p > (mejor?.puntaje ?? 0)) mejor = { rect: r, puntaje: p };
        }
      }
    }
  }
  return mejor;
}
