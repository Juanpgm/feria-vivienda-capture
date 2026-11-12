import { z } from "zod";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { fijarEnlace } from "@/modules/ciudadano/server/ciudadanos.repo";

export const runtime = "nodejs";

/** Admin+ only: turns the citizen link on or off (effective on the very next citizen request). */
export function PUT(req: Request) {
  return conErrores(async () => {
    const actor = await requireSesion("admin");
    const { habilitado } = z.object({ habilitado: z.boolean() }).parse(await req.json().catch(() => ({})));
    await fijarEnlace(habilitado, actor);
    return respuesta(200, { habilitado });
  });
}
