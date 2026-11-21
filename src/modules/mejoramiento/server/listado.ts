// Who sees which visits (S7): an inspector only their own; admin/superadmin every visit. Used by the pages and
// the croquis routes, so the rule lives in one place.
import type { Sesion } from "@/modules/auth/server/sesion";
import { firmarLectura } from "@/shared/s3";
import { listarVisitas, obtenerVisita, visible, type Alcance, type VisitaDoc } from "./visitas.repo";

export const alcanceDe = (s: Pick<Sesion, "uid" | "rol">): Alcance => (s.rol === "inspector" ? s.uid : null);

/** `inspector` filters an admin's list; an inspector is always limited to their own visits. */
export const visitasVisibles = (s: Sesion, inspector?: string) => listarVisitas({ uid: alcanceDe(s) ?? inspector });

/**
 * The visit plus presigned GETs (10 min) for every stored file, keyed by S3 key; null when the visit does not
 * exist or is not visible to the caller (the page answers 404 either way, so nothing leaks).
 */
export async function detalleVisible(s: Sesion, id: string): Promise<{ visita: VisitaDoc; urls: Record<string, string> } | null> {
  const visita = await obtenerVisita(id);
  if (!visita || !visible(visita, alcanceDe(s))) return null;
  const keys = [...(visita.archivos ?? []).map((a) => a.key), visita.inspector.firma_key, ...(visita.croquis ?? []).map((c) => c.key)].filter(Boolean);
  const urls = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await firmarLectura(k)] as const)));
  return { visita, urls };
}
