import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { conPostulacion, idValido } from "@/modules/postulacion/server/api";
import { entradaEdicion, MAX_CUERPO } from "@/modules/postulacion/server/entrada";
import { editarPostulacion } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

/** Staff edit of a postulación that is not validated yet (S11). */
export function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conPostulacion(async () => {
    const actor = await requireSesion("usuario");
    const { id } = await ctx.params;
    if (!idValido(id)) return respuesta(404, { error: "Postulación no encontrada" });
    if (Number(req.headers.get("content-length") ?? 0) > MAX_CUERPO) return respuesta(413, { error: "El envío es demasiado grande" });
    const e = entradaEdicion(await req.json().catch(() => ({})));
    await editarPostulacion(id, e, actor);
    return respuesta(200, { id, faltantes: e.faltantes });
  });
}
