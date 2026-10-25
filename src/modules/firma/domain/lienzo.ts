// Pure geometry of the signature pad (no DOM): empty detection, smoothing points and the export plan.
// Coordinates are in "logical" pad units (the pad is LIENZO_ANCHO x LIENZO_ALTO whatever its on-screen size).

export type Punto = { x: number; y: number };
export type Trazo = Punto[];

export const LIENZO_ANCHO = 600;
export const LIENZO_ALTO = 300;
export const GROSOR_TRAZO = 3.2;
/** Always dark ink on a light pad, in light and dark themes alike. */
export const COLOR_TINTA = "#111827";
export const COLOR_FONDO = "#ffffff";
/** The exported image must not exceed this (server cap for `firma`). */
export const MAX_FIRMA_BYTES = 100 * 1024;

/** Minimum ink to count as a signature: a tap, a dot or a short scratch is rejected. */
export const MIN_LONGITUD = 80;
export const MIN_EXTENSION = 40;

export const distancia = (a: Punto, b: Punto) => Math.hypot(b.x - a.x, b.y - a.y);

export function longitudTrazo(t: Trazo): number {
  let total = 0;
  for (let i = 1; i < t.length; i++) total += distancia(t[i - 1], t[i]);
  return total;
}

export const longitudTotal = (trazos: readonly Trazo[]) => trazos.reduce((s, t) => s + longitudTrazo(t), 0);

/** Bounding box size of all points (0 x 0 when empty). */
export function extension(trazos: readonly Trazo[]): { ancho: number; alto: number } {
  const pts = trazos.flat();
  if (!pts.length) return { ancho: 0, alto: 0 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { ancho: Math.max(...xs) - Math.min(...xs), alto: Math.max(...ys) - Math.min(...ys) };
}

/** True when the pad holds no usable signature. */
export function firmaVacia(trazos: readonly Trazo[]): boolean {
  if (!trazos.length) return true;
  const { ancho, alto } = extension(trazos);
  return longitudTotal(trazos) < MIN_LONGITUD || Math.max(ancho, alto) < MIN_EXTENSION;
}

export const puntoMedio = (a: Punto, b: Punto): Punto => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Drops points closer than `minimo` to the previous kept one (keeps the last), so jitter does not bloat the stroke. */
export function aligerar(t: Trazo, minimo = 0.8): Trazo {
  if (t.length < 3) return t;
  const out: Trazo = [t[0]];
  for (let i = 1; i < t.length - 1; i++) if (distancia(out[out.length - 1], t[i]) >= minimo) out.push(t[i]);
  out.push(t[t.length - 1]);
  return out;
}

/** Export attempts, largest first: PNG at decreasing scales (ink on white compresses very well), then WebP. */
export const PLAN_EXPORTACION: readonly { mime: "image/png" | "image/webp"; escala: number; calidad?: number }[] = [
  { mime: "image/png", escala: 1 },
  { mime: "image/png", escala: 0.75 },
  { mime: "image/png", escala: 0.5 },
  { mime: "image/webp", escala: 0.5, calidad: 0.8 },
  { mime: "image/webp", escala: 0.4, calidad: 0.6 },
];

/** Bytes of a data URL's payload (base64 length * 3/4 minus padding). */
export function bytesDeDataUrl(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** First export of the plan that fits `limite`; null when none does. `codificar` returns a data URL (or "" when unsupported). */
export function elegirExportacion(codificar: (e: (typeof PLAN_EXPORTACION)[number]) => string, limite = MAX_FIRMA_BYTES): string | null {
  for (const intento of PLAN_EXPORTACION) {
    const url = codificar(intento);
    if (url.startsWith(`data:${intento.mime}`) && bytesDeDataUrl(url) <= limite) return url;
  }
  return null;
}
