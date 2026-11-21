// Client-side submit orchestration: POST /api/visitas -> PUT each file straight to S3 (presigned) -> confirm.
import type { RespuestaEnvio, SolicitudEnvio } from "../domain/envio";

export type ProgresoEnvio = { etapa: "datos" | "archivos" | "confirmar"; subidos: number; total: number };
export type ResultadoEnvio = { ok: true; id: string; codigo: string } | { ok: false; error: string; requiere_firma?: boolean };

const SIN_RED = "Sin conexión con el servidor. Sus datos siguen guardados en este equipo; intente de nuevo.";

async function json(url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** PUT with two retries (spotty field connections); the presigned URL stays valid for 15 minutes. */
async function subir(url: string, headers: Record<string, string>, blob: Blob) {
  for (let intento = 0; ; intento++) {
    const r = await fetch(url, { method: "PUT", headers, body: blob }).catch(() => null);
    if (r?.ok) return;
    if (intento === 2) throw new Error("subida");
    await new Promise((ok) => setTimeout(ok, 1000 * (intento + 1)));
  }
}

/**
 * `blobs` maps each manifest `ref` to its bytes. Idempotent: calling it again with the same visita.id after a
 * failure resumes (same code, fresh URLs) instead of creating a second visit.
 */
export async function enviarVisita(
  solicitud: SolicitudEnvio,
  blobs: Map<string, Blob>,
  onProgreso?: (p: ProgresoEnvio) => void,
): Promise<ResultadoEnvio> {
  try {
    onProgreso?.({ etapa: "datos", subidos: 0, total: solicitud.archivos.length });
    const r = await json("/api/visitas", solicitud);
    if (!r.ok) return { ok: false, error: String(r.data.error ?? "No se pudo registrar la visita."), requiere_firma: r.data.requiere_firma === true };
    const { id, codigo, subidas } = r.data as unknown as RespuestaEnvio & { registrada: boolean };

    let subidos = 0;
    onProgreso?.({ etapa: "archivos", subidos, total: subidas.length });
    for (const s of subidas) {
      const blob = blobs.get(s.ref);
      if (!blob) return { ok: false, error: "Falta un archivo en este equipo. Vuelva a tomar las fotos o la firma." };
      try {
        await subir(s.url, s.headers, blob);
      } catch {
        return { ok: false, error: `No se pudieron subir los archivos (${subidos} de ${subidas.length}). Revise la señal e intente de nuevo: la visita ${codigo} ya está reservada.` };
      }
      onProgreso?.({ etapa: "archivos", subidos: ++subidos, total: subidas.length });
    }

    onProgreso?.({ etapa: "confirmar", subidos, total: subidas.length });
    const c = await json(`/api/visitas/${id}/confirmar`);
    if (!c.ok) return { ok: false, error: String(c.data.error ?? "No se pudo confirmar la visita.") };
    return { ok: true, id, codigo };
  } catch {
    return { ok: false, error: SIN_RED };
  }
}
