import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { validarAdjunto } from "@/modules/documentos/server/adjuntos.repo";
import { conPostulacion, idValido } from "@/modules/postulacion/server/api";
import { validacionSchema } from "@/modules/postulacion/server/entrada";
import { validarPostulacion } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

/** Any approved official validates a complete postulación, signing it (S13). */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conPostulacion(async () => {
    const actor = await requireSesion("usuario");
    const { id } = await ctx.params;
    if (!idValido(id)) return respuesta(404, { error: "Postulación no encontrada" });
    const v = validacionSchema.parse(await req.json().catch(() => ({})));
    const firma = validarAdjunto({ tipo: "firma", imagen: v.firma });
    return respuesta(200, await validarPostulacion(id, { folios_anexos: v.folios_anexos, firma }, actor, req.headers.get("user-agent") ?? ""));
  });
}
