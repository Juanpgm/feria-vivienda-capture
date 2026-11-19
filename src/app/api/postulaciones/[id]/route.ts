import { z } from "zod";
import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { conPostulacion, idValido } from "@/modules/postulacion/server/api";
import { entradaEdicion, MAX_CUERPO } from "@/modules/postulacion/server/entrada";
import { borrarPostulacion, editarPostulacion } from "@/modules/postulacion/server/postulaciones.repo";

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

const borrado = z.object({ motivo: z.string({ error: "Escriba el motivo del borrado" }).trim().min(10, "El motivo debe tener al menos 10 caracteres").max(500) });

/** Admin/superadmin only: deletes a postulación (and its validation) for good, leaving an audit entry with the reason. */
export function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conPostulacion(async () => {
    const actor = await requireSesion("admin");
    const { id } = await ctx.params;
    if (!idValido(id)) return respuesta(404, { error: "Postulación no encontrada" });
    const { motivo } = borrado.parse(await req.json().catch(() => ({})));
    return respuesta(200, await borrarPostulacion(id, motivo, actor));
  });
}
