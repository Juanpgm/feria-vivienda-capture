// Pure checks that a photo "looks like a document photo": sharp, well lit, textured (text, portrait, barcode) and
// of a sensible shape. They run on a downscaled RGBA buffer, in the browser, before the photo is accepted.
// Calibrated on ~80 real ID photos already uploaded (phones AND webcams; 60 % are portrait, sharpness from 39 to 11800,
// contrast 14-91, edge share 0.012-0.43): the limits sit below the worst real photo, so they only stop blank, blurred,
// too dark/bright or absurdly shaped images. Not a classifier: it cannot tell a card from any other textured photo.
// Anything stricter (is it THIS document?) needs OCR / a model and is deliberately out of scope here.

export type Pixeles = { data: Uint8ClampedArray; width: number; height: number };
export type Metricas = { media: number; desviacion: number; nitidez: number; bordes: number };
export type ResultadoCalidad = { ok: true } | { ok: false; mensaje: string };

/** Width every analysis is normalized to, so the thresholds do not depend on the camera resolution. */
export const ANCHO_ANALISIS = 480;

export const UMBRALES = { mediaMin: 30, mediaMax: 240, desviacionMin: 10, nitidezMin: 15, bordesMin: 0.006, bordesMax: 0.6, relacionMin: 0.5, relacionMax: 2.4 } as const;

function grises({ data, width, height }: Pixeles): Float32Array {
  const g = new Float32Array(width * height);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return g;
}

export function metricas(p: Pixeles): Metricas {
  const { width: w, height: h } = p;
  const g = grises(p);
  let suma = 0;
  for (const v of g) suma += v;
  const media = suma / g.length;
  let varianza = 0;
  for (const v of g) varianza += (v - media) ** 2;
  const desviacion = Math.sqrt(varianza / g.length);

  // Variance of the Laplacian (sharpness) and share of pixels with a clear gradient (texture).
  let sl = 0;
  let sl2 = 0;
  let bordes = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      sl += lap;
      sl2 += lap * lap;
      if (Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]) > 40) bordes++;
      n++;
    }
  }
  const mediaLap = sl / n;
  return { media, desviacion, nitidez: sl2 / n - mediaLap * mediaLap, bordes: bordes / n };
}

export function evaluarCedula(m: Metricas, ancho: number, alto: number): ResultadoCalidad {
  const relacion = ancho / alto;
  if (relacion < UMBRALES.relacionMin || relacion > UMBRALES.relacionMax) return { ok: false, mensaje: "La imagen es demasiado alargada. Tome la foto de la cédula completa, sin recortarla." };
  if (m.media < UMBRALES.mediaMin) return { ok: false, mensaje: "La foto está muy oscura. Busque más luz e intente de nuevo." };
  if (m.media > UMBRALES.mediaMax) return { ok: false, mensaje: "La foto tiene demasiada luz o reflejo. Evite el brillo directo sobre la cédula." };
  if (m.nitidez < UMBRALES.nitidezMin) return { ok: false, mensaje: "La foto está borrosa. Sostenga firme el celular y acérquese hasta que el texto se lea." };
  if (m.desviacion < UMBRALES.desviacionMin || m.bordes < UMBRALES.bordesMin || m.bordes > UMBRALES.bordesMax)
    return { ok: false, mensaje: "Esta imagen no parece una cédula. Debe ser la foto de su cédula de ciudadanía, completa y con el texto legible." };
  return { ok: true };
}

/** 64-bit average hash (8x8) as 64 chars of 0/1: two photos of the same side of the same card give a tiny distance. */
export function huella(p: Pixeles): string {
  const g = grises(p);
  const celdas: number[] = [];
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      let s = 0;
      let c = 0;
      for (let y = Math.floor((cy * p.height) / 8); y < Math.floor(((cy + 1) * p.height) / 8); y++)
        for (let x = Math.floor((cx * p.width) / 8); x < Math.floor(((cx + 1) * p.width) / 8); x++) {
          s += g[y * p.width + x];
          c++;
        }
      celdas.push(c ? s / c : 0);
    }
  }
  const media = celdas.reduce((a, b) => a + b, 0) / celdas.length;
  return celdas.map((v) => (v >= media ? "1" : "0")).join("");
}

export const distanciaHuella = (a: string, b: string) => [...a].reduce((d, c, i) => d + (c === b[i] ? 0 : 1), 0);

/** Front and back are different sides: nearly identical photos mean the same side was uploaded twice. */
export const MISMA_FOTO_MAX = 6;
