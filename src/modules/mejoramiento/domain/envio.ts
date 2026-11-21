// Contract between the visit form (client) and POST /api/visitas (server). The client never names S3 keys:
// it sends a manifest of opaque refs; the server answers with one presigned PUT per ref.
import { z } from "zod";
import { claveFirmaCiudadano, claveFoto, erroresFotos, MAX_BYTES_ARCHIVO, nombresFotos, TIPOS_FOTO } from "./fotos";
import type { VisitaEntrada } from "./visita";

export const archivoSchema = z.discriminatedUnion("tipo", [
  z.object({
    /** Client-side id of the file (e.g. the IndexedDB key suffix). Only used to match the presigned URL back. */
    ref: z.string().regex(/^[A-Za-z0-9-]{1,60}$/),
    tipo: z.literal("foto"),
    /** Quantity row (capitulos[].filas[].id) the photo documents. */
    fila_id: z.string().regex(/^[A-Za-z0-9-]{1,40}$/),
    content_type: z.enum(TIPOS_FOTO),
    bytes: z.number().int().positive().max(MAX_BYTES_ARCHIVO),
  }),
  z.object({
    ref: z.string().regex(/^[A-Za-z0-9-]{1,60}$/),
    tipo: z.literal("firma_ciudadano"),
    content_type: z.literal("image/png"),
    bytes: z.number().int().positive().max(MAX_BYTES_ARCHIVO),
  }),
]);
export type ArchivoManifiesto = z.infer<typeof archivoSchema>;

export const ubicacionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  /** Accuracy reported by the browser, metres. */
  precision_m: z.number().nonnegative().max(100_000).nullable(),
});
export type UbicacionGps = z.infer<typeof ubicacionSchema>;

export type SolicitudEnvio = { visita: VisitaEntrada; ubicacion: UbicacionGps; archivos: ArchivoManifiesto[] };

export type Subida = { ref: string; url: string; headers: Record<string, string> };
export type RespuestaEnvio = { id: string; codigo: string; subidas: Subida[] };

export type ArchivoAsignado = ArchivoManifiesto & { key: string };

/**
 * Validates the manifest against the visit and gives every file its server-chosen S3 key. Photo names follow
 * the row order of the visit (consecutive per ITEM); exactly one citizen signature.
 */
export function planearArchivos(
  codigo: string,
  visita: { atiende: { documento: string }; diagnostico: { aplica: "si" | "no" }; capitulos: { filas: { id: string; item: string }[] }[] },
  archivos: ArchivoManifiesto[],
): { ok: true; archivos: ArchivoAsignado[] } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  const refs = new Set(archivos.map((a) => a.ref));
  if (refs.size !== archivos.length) errores.push("Hay archivos repetidos en el envío");
  const firmas = archivos.filter((a) => a.tipo === "firma_ciudadano");
  if (firmas.length !== 1) errores.push("Se requiere una firma de quien atiende la visita");

  const filas = visita.capitulos.flatMap((c) => c.filas);
  if (new Set(filas.map((f) => f.id)).size !== filas.length) errores.push("Hay actividades con el mismo identificador");
  const fotos = archivos.filter((a) => a.tipo === "foto");
  const porFila = new Map(filas.map((f) => [f.id, fotos.filter((a) => a.fila_id === f.id)]));
  if (fotos.some((a) => !porFila.has(a.fila_id))) errores.push("Hay fotos de una actividad que no está en la visita");
  errores.push(...erroresFotos(filas.map((f) => porFila.get(f.id)!.length)));
  if (errores.length) return { ok: false, errores };

  const nombres = nombresFotos(codigo, filas.map((f) => ({ item: f.item, fotos: porFila.get(f.id)!.length })));
  const asignados: ArchivoAsignado[] = filas.flatMap((f, i) => porFila.get(f.id)!.map((a, j) => ({ ...a, key: claveFoto(codigo, nombres[i][j], a.content_type) })));
  asignados.push({ ...firmas[0], key: claveFirmaCiudadano(codigo, visita.atiende.documento) });
  return { ok: true, archivos: asignados };
}
