// Uploads the draft's photos to POST /api/registros/{id}/adjuntos, one request per image. The endpoint is an
// idempotent upsert, so a retry (or calling this again after a partial failure) never duplicates anything.
import { TIPOS_FOTO, type TipoAdjunto } from "../domain/imagen";
import { cargarFoto } from "./fotos";

export type ResultadoAdjunto = { tipo: TipoAdjunto; estado: "subido" | "error" | "faltante"; intentos: number; mensaje?: string };

export class ErrorSubida extends Error {
  constructor(
    message: string,
    /** Worth retrying (network, 5xx, 408, 429); false for definitive rejections (4xx). */
    readonly reintentable: boolean,
  ) {
    super(message);
  }
}

const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** Runs `fn` up to `intentos` times with exponential backoff (base, 2*base, 4*base...) while the failure is retryable. */
export async function conReintentos<T>(
  fn: () => Promise<T>,
  { intentos = 4, baseMs = 500, esperar = dormir }: { intentos?: number; baseMs?: number; esperar?: (ms: number) => Promise<void> } = {},
): Promise<{ valor: T; intentos: number } | { error: Error; intentos: number }> {
  let ultimo: Error = new Error("Error desconocido");
  for (let n = 1; n <= intentos; n++) {
    try {
      return { valor: await fn(), intentos: n };
    } catch (e) {
      ultimo = e as Error;
      if (e instanceof ErrorSubida && !e.reintentable) return { error: ultimo, intentos: n };
      if (n < intentos) await esperar(baseMs * 2 ** (n - 1));
    }
  }
  return { error: ultimo, intentos };
}

async function aBase64(blob: Blob): Promise<string> {
  const lector = new FileReader();
  const url = await new Promise<string>((ok, mal) => {
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(",") + 1);
}

/** One image (also used by the signature step with tipo "firma"). Throws ErrorSubida. */
export async function enviarAdjunto(registroId: string, tipo: TipoAdjunto, imagen: Blob): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/registros/${encodeURIComponent(registroId)}/adjuntos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, imagen: await aBase64(imagen) }),
    });
  } catch {
    throw new ErrorSubida("No hay conexión con el servidor", true);
  }
  if (res.ok) return;
  const j = await res.json().catch(() => ({}));
  const mensaje = typeof j?.error === "string" ? j.error : "No se pudo subir la imagen";
  throw new ErrorSubida(mensaje, res.status >= 500 || res.status === 408 || res.status === 429);
}

/**
 * Uploads front and back photos of draft `draft.id` to the registro `registroId` (the same uuid in this app, the
 * registro id IS the draft id). Returns one status per photo; callers must treat any non-"subido" as not submitted.
 * Photos are NOT removed from the device here: remove them with `descartarFotos` once every status is "subido".
 */
export async function subirAdjuntos(
  registroId: string,
  draft: { id: string },
  opciones?: Parameters<typeof conReintentos>[1],
): Promise<ResultadoAdjunto[]> {
  const out: ResultadoAdjunto[] = [];
  for (const tipo of TIPOS_FOTO) {
    const foto = await cargarFoto(draft.id, tipo).catch(() => undefined);
    if (!foto) {
      out.push({ tipo, estado: "faltante", intentos: 0, mensaje: "La foto no está guardada en este equipo" });
      continue;
    }
    const r = await conReintentos(() => enviarAdjunto(registroId, tipo, foto.blob), opciones);
    out.push("error" in r ? { tipo, estado: "error", intentos: r.intentos, mensaje: r.error.message } : { tipo, estado: "subido", intentos: r.intentos });
  }
  return out;
}
