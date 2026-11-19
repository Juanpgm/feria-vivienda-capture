// Server-only: typed address -> cadastral address, barrio, comuna, estrato and coordinates, through the geocoder of the
// Alcaldía de Cali (public, no key). Same service and call as atencionsismo_SGRED/lib/geo/geocoder.ts.
import barrios from "../catalogo/barrios.json";
import { estratoDeBarrio } from "../domain/ubicacion";

const BASE = process.env.GEOCODER_API_BASE ?? "https://geocodificador.ia.cali.gov.co/api";
const LUGAR = new Map(barrios.map((b) => [b.id, b]));

export type Ubicacion = {
  /** Cadastral address of the Alcaldía ("CL 5 # 38 - 20"); present even when the address could not be located. */
  direccion_catastral: string | null;
  id_barrio_vereda: string | null;
  nombre_barrio_vereda: string | null;
  codigo_division: string | null;
  estrato: number | null;
  latitud: number | null;
  longitud: number | null;
};

type Respuesta = {
  direccionEstandarizada?: { direccion?: string | null } | null;
  barrio?: { codigo?: string | null; nombre?: string | null } | null;
  estrato?: string | number | null;
  latitud?: number | null;
  longitud?: number | null;
};

/** The geocoder answer -> our catalog ids (pure, unit tested). A barrio outside our catalog counts as not located. */
export function interpretar(r: Respuesta | null | undefined): Ubicacion | null {
  if (!r) return null;
  const direccion_catastral = r.direccionEstandarizada?.direccion?.trim() || null;
  const b = r.barrio?.codigo ? LUGAR.get(r.barrio.codigo) : undefined;
  const e = Number(r.estrato);
  const coords = typeof r.latitud === "number" && typeof r.longitud === "number";
  return {
    direccion_catastral,
    id_barrio_vereda: b?.id ?? null,
    nombre_barrio_vereda: b?.nombre ?? null,
    codigo_division: b?.codigo_division ?? null,
    estrato: b ? (Number.isInteger(e) && e >= 1 && e <= 6 ? e : estratoDeBarrio(b.id)) : null,
    latitud: b && coords ? Math.round(r.latitud! * 1e6) / 1e6 : null,
    longitud: b && coords ? Math.round(r.longitud! * 1e6) / 1e6 : null,
  };
}

// ponytail: per-instance cache; the service has no documented rate limit.
const cache = new Map<string, Ubicacion | null>();

/** Null when the service is down or slow (the form then asks for comuna and barrio). */
export async function geocodificar(direccion: string, f: typeof fetch = fetch): Promise<Ubicacion | null> {
  const q = direccion.trim().replace(/\s+/g, " ");
  if (q.length < 5) return null;
  if (cache.has(q)) return cache.get(q)!;
  try {
    const res = await f(`${BASE}/individual/geocodificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direccion: q }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const u = interpretar((await res.json()) as Respuesta);
    if (cache.size > 500) cache.clear();
    cache.set(q, u);
    return u;
  } catch {
    return null;
  }
}
