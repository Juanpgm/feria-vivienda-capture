// Live detection of an ID-1 card (85.6 x 54 mm, ratio 1.586) in a camera frame, with no ML and no dependency.
// 1) Coarse search: candidate rectangles around the on-screen guide, scored by how well their four sides sit on a step
//    edge of the same polarity (card lighter than the table, or darker, on every side).
// 2) Refinement: the measured edge position of each side gives the real contour, so the result hugs the whole card.
// 3) Verdict: "completa" only when the four sides are found, the refined shape has card proportions, the card is not cut
//    by the image border and is big enough to read. Otherwise it says what is wrong (a side missing, too small, cut).
// It works on a downscaled luminance image so it can run several times per second on a phone.

export type Rect = { x: number; y: number; w: number; h: number };
export type LadoNombre = "izquierdo" | "derecho" | "superior" | "inferior";

export type Analisis =
  | { estado: "ninguna" }
  /** Three sides found: the fourth is hidden, cut by the border or not contrasting. */
  | { estado: "parcial"; faltante: LadoNombre }
  /** Four sides found but the card is not usable yet. */
  | { estado: "ajustar"; rect: Rect; problema: "pequena" | "cortada" }
  | { estado: "completa"; rect: Rect; puntaje: number };

export const RELACION_TARJETA = 1.586;

const CONTRASTE_MIN = 14; // luminance step (0-255) that counts as an edge
const LADO_MIN = 0.6; // share of sampled positions of a side that must show the edge
const DESVIACION_MIN = 10; // inside of the card is not a flat patch
const RELACION_TOLERANCIA = 0.14; // refined shape may differ from 1.586 by this much (perspective, rounded corners)
const MARGEN_BORDE = 0.025; // the card must stay this far from the image border (share of the side)
const ANCHO_MIN = 0.3; // card narrower than this share of the long side of the image is too small to read

type Gris = { g: Float32Array; w: number; h: number };

/** RGBA -> luminance. */
export function aGris(data: Uint8ClampedArray, w: number, h: number): Gris {
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return { g, w, h };
}

type Lado = {
  frac: number;
  signo: number;
  /** mean distance of the found edge to the nominal side, as a share of the band */
  desvio: number;
  /** measured position of the edge (median), same axis as the nominal side */
  pos: number;
};
const SIN_LADO: Lado = { frac: 0, signo: 0, desvio: 1, pos: 0 };

/**
 * One side of `r`. `vertical`: left/right side (scan rows); `dentro`: +1 when the inside lies at larger coordinates
 * (left and top sides), -1 otherwise. The edge is searched within +-`banda` pixels of the nominal position.
 */
function lado({ g, w, h }: Gris, r: Rect, vertical: boolean, fijo: number, dentro: 1 | -1, banda: number): Lado {
  const desde = vertical ? r.y + r.h * 0.12 : r.x + r.w * 0.12;
  const hasta = vertical ? r.y + r.h * 0.88 : r.x + r.w * 0.88;
  let total = 0;
  let suma = 0;
  const posiciones: number[] = [];
  for (let t = Math.round(desde); t <= hasta; t += 2) {
    let mejor = 0;
    let enP = fijo;
    for (let p = fijo - banda; p <= fijo + banda; p++) {
      const a = p + dentro * 2; // inside samples
      const b = p - dentro * 2; // outside samples
      const [ax, ay, bx, by] = vertical ? [a, t, b, t] : [t, a, t, b];
      // Samples outside the image cannot show an edge: they count against the side instead of invalidating it.
      if (ax < 0 || bx < 0 || ay < 0 || by < 0 || ax + 1 >= w || bx + 1 >= w || ay + 1 >= h || by + 1 >= h) continue;
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
      suma += Math.sign(mejor);
      posiciones.push(enP);
    }
  }
  if (!total || !posiciones.length) return SIN_LADO;
  posiciones.sort((x, y) => x - y);
  const pos = posiciones[Math.floor(posiciones.length / 2)];
  const desvio = posiciones.reduce((a, p) => a + Math.abs(p - fijo), 0) / posiciones.length / banda;
  return { frac: posiciones.length / total, signo: Math.sign(suma), desvio, pos };
}

function desviacion({ g, w }: Gris, r: Rect): number {
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(r.y)); y < Math.min(r.y + r.h, g.length / w); y += 2)
    for (let x = Math.max(0, Math.round(r.x)); x < Math.min(r.x + r.w, w); x += 2) {
      const v = g[y * w + x];
      s += v;
      s2 += v * v;
      n++;
    }
  return n ? Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) : 0;
}

const NOMBRES: LadoNombre[] = ["izquierdo", "derecho", "superior", "inferior"];

function medir(img: Gris, r: Rect): Lado[] {
  const banda = Math.max(3, Math.round(Math.min(r.w, r.h) * 0.1));
  return [
    lado(img, r, true, Math.round(r.x), 1, banda),
    lado(img, r, true, Math.round(r.x + r.w), -1, banda),
    lado(img, r, false, Math.round(r.y), 1, banda),
    lado(img, r, false, Math.round(r.y + r.h), -1, banda),
  ];
}

const buenos = (lados: Lado[]) => lados.map((l) => l.frac >= LADO_MIN && l.signo !== 0);
const mismoSigno = (lados: Lado[], ok: boolean[]) => {
  const s = lados.filter((_, i) => ok[i]).map((l) => l.signo);
  return s.every((x) => x === s[0]);
};
/** Tight fits win over loose ones: the edges must sit ON the candidate's sides. */
const puntajeDe = (lados: Lado[]) => lados.reduce((a, l) => a + l.frac * (1 - 0.6 * l.desvio), 0) / 4;

/** Whole contour from the measured edge positions of the four sides. */
function contorno(lados: Lado[]): Rect {
  return { x: lados[0].pos, y: lados[2].pos, w: lados[1].pos - lados[0].pos, h: lados[3].pos - lados[2].pos };
}

const tieneFormaDeTarjeta = (r: Rect) => {
  const rel = r.w / r.h;
  const ok = (v: number) => Math.abs(v - RELACION_TARJETA) <= RELACION_TARJETA * RELACION_TOLERANCIA;
  return r.w > 8 && r.h > 8 && (ok(rel) || ok(1 / rel));
};

/** 0, +-paso, +-2*paso... up to +-max. */
const desplazamientos = (paso: number, max: number) => {
  const o = [0];
  for (let d = paso; d <= max; d += paso) o.push(d, -d);
  return o;
};

/**
 * Looks for a card near `guia` (the frame drawn on screen), horizontal or vertical. Candidates are the guide scaled
 * 0.35-1.4 and shifted up to +-12 % of the image; the best one is refined to the measured edges.
 */
function porBordes(img: Gris, w: number, h: number, guia: Rect): Analisis {
  let mejor: { r: Rect; lados: Lado[]; puntaje: number } | null = null;
  let parcial: { faltante: LadoNombre; puntaje: number } | null = null;
  for (const giro of [false, true]) {
    const base = giro ? { w: guia.h, h: guia.w } : { w: guia.w, h: guia.h };
    for (const s of [0.35, 0.42, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4]) {
      const cw = base.w * s;
      const ch = base.h * s;
      const cx = guia.x + guia.w / 2;
      const cy = guia.y + guia.h / 2;
      // Shift steps follow the candidate's edge-search band, so a small card is not stepped over.
      const paso = Math.max(2, Math.round(Math.min(cw, ch) * 0.1));
      for (const dx of desplazamientos(paso, w * 0.12)) {
        for (const dy of desplazamientos(paso, h * 0.12)) {
          const r = { x: cx - cw / 2 + dx, y: cy - ch / 2 + dy, w: cw, h: ch };
          // A candidate may run past the image: the side that falls outside simply cannot be seen (=> "parcial").
          if (r.x < -r.w * 0.5 || r.y < -r.h * 0.5 || r.x + r.w > w + r.w * 0.5 || r.y + r.h > h + r.h * 0.5) continue;
          const lados = medir(img, r);
          const ok = buenos(lados);
          const cuantos = ok.filter(Boolean).length;
          if (cuantos < 3 || !mismoSigno(lados, ok) || desviacion(img, r) < DESVIACION_MIN) continue;
          const p = puntajeDe(lados);
          if (cuantos === 4) {
            if (p > (mejor?.puntaje ?? 0)) mejor = { r, lados, puntaje: p };
          } else if (p > (parcial?.puntaje ?? 0)) parcial = { faltante: NOMBRES[ok.indexOf(false)], puntaje: p };
        }
      }
    }
  }
  if (!mejor) return parcial ? { estado: "parcial", faltante: parcial.faltante } : { estado: "ninguna" };

  // Refine: the real contour is where the edges were measured, not where the candidate was drawn.
  let r = contorno(mejor.lados);
  const lados2 = medir(img, r);
  const ok2 = buenos(lados2);
  if (ok2.every(Boolean) && mismoSigno(lados2, ok2)) r = contorno(lados2);
  if (!tieneFormaDeTarjeta(r)) return { estado: "ninguna" };
  return veredicto(r, w, h, mejor.puntaje);
}

/** Margin to the border and readable size: the same rules whichever detector found the rectangle. */
function veredicto(r: Rect, w: number, h: number, puntaje: number): Analisis {
  const margenX = w * MARGEN_BORDE;
  const margenY = h * MARGEN_BORDE;
  if (r.x < margenX || r.y < margenY || r.x + r.w > w - margenX || r.y + r.h > h - margenY) return { estado: "ajustar", rect: r, problema: "cortada" };
  if (Math.max(r.w, r.h) < Math.max(w, h) * ANCHO_MIN) return { estado: "ajustar", rect: r, problema: "pequena" };
  return { estado: "completa", rect: r, puntaje };
}

// ---- Fallback for a card on a background of nearly the same brightness (white card on a white table) ----
// There the card edge is almost invisible, but the card is PRINTED (text, portrait, barcode) and the table is flat:
// the card is the one compact textured blob on a plain surface. Found with the bounding box of the texture, accepted
// only when the surroundings are flat, the blob is dense and it has card proportions.

const TEXTURA_UMBRAL = 16; // gradient (after a 3x3 blur) that counts as printed detail
const TEXTURA_RADIO = 3; // detail closer than this is merged into one blob (gaps between text lines)
const DENSIDAD_DENTRO = 0.22; // share of the blob that must be detail
const DENSIDAD_FUERA = 0.05; // share of the surroundings that may be detail (a plain table)
const TEXTURA_TOLERANCIA = 0.2;
const TEXTURA_RELLENO = 0.08; // the printed area is a bit smaller than the card: grow the box by this share

/** Longest run of columns/rows whose count reaches `minimo`, allowing small gaps. Null when none. */
function tramoLargo(cuentas: Int32Array, minimo: number, hueco = 4): [number, number] | null {
  let mejor: [number, number] | null = null;
  let ini = -1;
  let fin = -1;
  for (let i = 0; i <= cuentas.length; i++) {
    const on = i < cuentas.length && cuentas[i] >= minimo;
    if (on) {
      if (ini < 0) ini = i;
      fin = i;
    } else if (ini >= 0 && (i >= cuentas.length || i - fin > hueco)) {
      if (!mejor || fin - ini > mejor[1] - mejor[0]) mejor = [ini, fin];
      ini = -1;
    }
  }
  return mejor;
}

export function porTextura({ g, w, h }: Gris): Rect | null {
  // 3x3 box blur, then gradient magnitude
  const b = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += g[(y + dy) * w + x + dx];
      b[y * w + x] = s / 9;
    }
  const m = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (Math.abs(b[i + 1] - b[i - 1]) + Math.abs(b[i + w] - b[i - w]) > TEXTURA_UMBRAL) m[i] = 1;
    }
  // dilate with an integral image: merges the gaps between text lines into one blob
  const I = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let fila = 0;
    for (let x = 0; x < w; x++) {
      fila += m[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + fila;
    }
  }
  const r = TEXTURA_RADIO;
  const d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(w, x + r + 1);
      const y1 = Math.min(h, y + r + 1);
      if (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0] > 0) d[y * w + x] = 1;
    }
  // bounding box from the projection profiles (columns first, then rows inside them, then columns again)
  const cols = (y0: number, y1: number) => {
    const c = new Int32Array(w);
    for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) c[x] += d[y * w + x];
    return c;
  };
  const filas = (x0: number, x1: number) => {
    const c = new Int32Array(h);
    for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) c[y] += d[y * w + x];
    return c;
  };
  const max = (a: Int32Array) => a.reduce((m2, v) => Math.max(m2, v), 0);
  const c1 = cols(0, h);
  const tx = tramoLargo(c1, Math.max(3, max(c1) * 0.15));
  if (!tx) return null;
  const f1 = filas(tx[0], tx[1] + 1);
  const ty = tramoLargo(f1, Math.max(3, max(f1) * 0.15));
  if (!ty) return null;
  const c2 = cols(ty[0], ty[1] + 1);
  const tx2 = tramoLargo(c2, Math.max(3, max(c2) * 0.15));
  if (!tx2) return null;
  const bw = tx2[1] - tx2[0] + 1;
  const bh = ty[1] - ty[0] + 1;
  // a card never fills most of the picture: a blob that does is clutter, not a card on a plain surface
  if (bw < 20 || bh < 14 || bw * bh > w * h * 0.6) return null;

  // isolation: dense inside, flat outside
  let dentro = 0;
  let fuera = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!d[y * w + x]) continue;
      if (x >= tx2[0] && x <= tx2[1] && y >= ty[0] && y <= ty[1]) dentro++;
      else fuera++;
    }
  if (dentro / (bw * bh) < DENSIDAD_DENTRO || fuera / Math.max(1, w * h - bw * bh) > DENSIDAD_FUERA) return null;

  // undo the dilation, then grow by a few percent (the printed area is a bit smaller than the card)
  const quitar = TEXTURA_RADIO + 2; // dilation + the blur/gradient halo
  const iw = bw - 2 * quitar;
  const ih = bh - 2 * quitar;
  const px = iw * TEXTURA_RELLENO;
  const py = ih * TEXTURA_RELLENO;
  const rect = { x: tx2[0] + quitar - px, y: ty[0] + quitar - py, w: iw + 2 * px, h: ih + 2 * py };
  const rel = rect.w / rect.h;
  const ok = (v: number) => Math.abs(v - RELACION_TARJETA) <= RELACION_TARJETA * TEXTURA_TOLERANCIA;
  return ok(rel) || ok(1 / rel) ? rect : null;
}

/**
 * Edge detector first (accurate on any contrasting surface); when it finds nothing usable, the texture detector
 * (white card on a white table). Never reports "completa" unless the four sides / a compact printed blob were seen.
 */
export function analizarTarjeta(data: Uint8ClampedArray, w: number, h: number, guia: Rect): Analisis {
  const img = aGris(data, w, h);
  const a = porBordes(img, w, h, guia);
  const t = porTextura(img);
  if (t) {
    // The edge detector can lock onto something INSIDE the card (the portrait box, the barcode area): when the printed
    // blob contains what it found, the blob is the card.
    const dentro =
      "rect" in a &&
      a.rect.x >= t.x &&
      a.rect.y >= t.y &&
      a.rect.x + a.rect.w <= t.x + t.w &&
      a.rect.y + a.rect.h <= t.y + t.h &&
      a.rect.w * a.rect.h < 0.6 * t.w * t.h; // clearly a part of it, not the same card measured more tightly
    if (a.estado === "ninguna" || a.estado === "parcial" || dentro) return veredicto(t, w, h, 0.5);
  }
  return a;
}
