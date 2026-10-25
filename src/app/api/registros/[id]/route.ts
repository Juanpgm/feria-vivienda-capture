import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { obtenerRegistro } from "@/modules/registro/server/registro.repo";

export const runtime = "nodejs";

/** Full read-only record. `usuario` only gets their own; anything not visible is a plain 404. */
export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conErrores(async () => {
    const actor = await requireSesion("usuario");
    const { id } = await ctx.params;
    const r = /^[0-9a-f-]{36}$/i.test(id) ? await obtenerRegistro(id, actor) : null;
    return r ? respuesta(200, r) : respuesta(404, { error: "Registro no encontrado" });
  });
}
