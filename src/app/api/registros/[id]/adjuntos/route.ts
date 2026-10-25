import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { AdjuntoError, guardarAdjunto, MAX_BASE64_CHARS, validarAdjunto } from "@/modules/documentos/server/adjuntos.repo";

export const runtime = "nodejs";

/**
 * Attaches ONE image (document photo or signature) to a registro created by the caller. Idempotent upsert.
 * Never echoes the image back: only metadata (tipo, mime, bytes, sha256).
 */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conErrores(async () => {
    const actor = await requireSesion("usuario");
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return respuesta(404, { error: "Registro no encontrado" });
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BASE64_CHARS + 1024) return respuesta(413, { error: "La imagen es demasiado grande" });
    try {
      const adjunto = validarAdjunto(await req.json().catch(() => ({})));
      return respuesta(200, await guardarAdjunto(id, adjunto, actor));
    } catch (e) {
      if (e instanceof AdjuntoError) return respuesta(e.status, { error: e.message });
      throw e;
    }
  });
}
