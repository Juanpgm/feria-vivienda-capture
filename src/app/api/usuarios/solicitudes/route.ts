import { puedeGestionar } from "@/modules/auth/domain/roles";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { listarSolicitudes } from "@/modules/auth/server/usuarios.repo";

export const runtime = "nodejs";

/** Pending role requests the actor may resolve. */
export function GET() {
  return conErrores(async () => {
    const actor = await requireSesion("admin");
    const solicitudes = (await listarSolicitudes()).filter(
      (s) => s.uid !== actor.uid && puedeGestionar(actor.rol, s.rol_actual) && puedeGestionar(actor.rol, s.rol_solicitado),
    );
    return respuesta(200, { solicitudes });
  });
}
