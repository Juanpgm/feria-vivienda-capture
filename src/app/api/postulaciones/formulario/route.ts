import { z } from "zod";
import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { conPostulacion } from "@/modules/postulacion/server/api";
import { fijarFormulario } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

/** Admin+ only: turns the public postulación form on or off (S17). */
export function PUT(req: Request) {
  return conPostulacion(async () => {
    const actor = await requireSesion("admin");
    const { habilitado } = z.object({ habilitado: z.boolean() }).parse(await req.json().catch(() => ({})));
    await fijarFormulario(habilitado, actor);
    return respuesta(200, { habilitado });
  });
}
