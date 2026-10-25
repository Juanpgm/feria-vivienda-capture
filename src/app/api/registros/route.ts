import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { registroSchema } from "@/modules/registro/domain/schema";
import { crearRegistro, RegistroConflictoError } from "@/modules/registro/server/registro.repo";

export const runtime = "nodejs";

/** Any approved staff may register. 201 created, 200 idempotent retry, 422 field errors, 409 id in use. */
export function POST(req: Request) {
  return conErrores(async () => {
    const actor = await requireSesion("usuario");
    const datos = registroSchema.parse(await req.json().catch(() => ({})));
    try {
      const r = await crearRegistro(datos, actor);
      return respuesta(r.creado ? 201 : 200, r);
    } catch (e) {
      if (e instanceof RegistroConflictoError) return respuesta(409, { error: "El identificador del registro ya está en uso" });
      throw e;
    }
  });
}
