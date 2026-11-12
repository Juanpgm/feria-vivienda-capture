import { conErrores, respuesta } from "@/modules/auth/server/api";
import { registroIdDe } from "@/modules/ciudadano/server/ciudadanos.repo";
import { UID_CIUDADANO } from "@/modules/ciudadano/server/registro";
import { requireCiudadano } from "@/modules/ciudadano/server/sesion";
import { AdjuntoError, guardarAdjunto, MAX_BASE64_CHARS, validarAdjunto } from "@/modules/documentos/server/adjuntos.repo";

export const runtime = "nodejs";

/** One image (document photo or signature) for the citizen's own registro, only while its upload window is open. */
export function POST(req: Request) {
  return conErrores(async () => {
    const c = await requireCiudadano();
    if (!c.registro_id || c.adjuntos_abiertos !== true) return respuesta(409, { error: "Su registro ya está completo" });
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BASE64_CHARS + 1024) return respuesta(413, { error: "La imagen es demasiado grande" });
    try {
      const adjunto = validarAdjunto(await req.json().catch(() => ({})));
      return respuesta(200, await guardarAdjunto(registroIdDe(c.documento), adjunto, { uid: UID_CIUDADANO, correo: "" }));
    } catch (e) {
      if (e instanceof AdjuntoError) return respuesta(e.status, { error: e.message });
      throw e;
    }
  });
}
