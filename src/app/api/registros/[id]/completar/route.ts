import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { marcarAdjuntosCompletos } from "@/modules/registro/server/registro.repo";

export const runtime = "nodejs";

/**
 * Final step of a submit, after the attachments were uploaded: the server checks which required attachments actually
 * exist and sets `adjuntos_completos` only when all of them do. Idempotent and safe to repeat.
 * 200 { completo, requeridos, presentes, faltan[] }; 404 when the registro is missing or not visible.
 */
export function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conErrores(async () => {
    const actor = await requireSesion("usuario");
    const { id } = await ctx.params;
    const r = /^[0-9a-f-]{36}$/i.test(id) ? await marcarAdjuntosCompletos(id, actor) : null;
    return r ? respuesta(200, r) : respuesta(404, { error: "Registro no encontrado" });
  });
}
