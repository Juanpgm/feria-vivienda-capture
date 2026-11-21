import { z } from "zod";
import { MOTIVO_MAX, puedeGestionar } from "@/modules/auth/domain/roles";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { aplicarRol } from "@/modules/auth/server/cambioRol";
import { requireSesion } from "@/modules/auth/server/sesion";
import { obtenerSolicitud, obtenerUsuario, resolverSolicitud } from "@/modules/auth/server/usuarios.repo";

const body = z.object({ aprobar: z.boolean(), motivo: z.string().trim().max(MOTIVO_MAX).optional() });

export const runtime = "nodejs";

/** Approve or reject a role request. The actor must manage both the current and the requested role. */
export function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  return conErrores(async () => {
    const actor = await requireSesion("admin");
    const { uid } = await ctx.params;
    const { aprobar, motivo } = body.parse(await req.json().catch(() => ({})));
    const s = await obtenerSolicitud(uid);
    if (!s) return respuesta(404, { error: "No hay una solicitud pendiente" });
    if (uid === actor.uid) return respuesta(403, { error: "No puede resolver su propia solicitud" });
    if (!puedeGestionar(actor.rol, s.rol_actual) || !puedeGestionar(actor.rol, s.rol_solicitado))
      return respuesta(403, { error: "No puede resolver esa solicitud" });
    const u = await obtenerUsuario(uid);
    // Already on the requested role (an earlier approval applied it but failed to close the request): just close it.
    const yaAplicada = aprobar && u?.rol === s.rol_solicitado;
    if (!u?.esta_aprobado || (u.rol !== s.rol_actual && !yaAplicada))
      return respuesta(409, { error: "El rol de la cuenta cambió; la solicitud ya no aplica" });

    if (aprobar && !yaAplicada) await aplicarRol(uid, s.rol_solicitado, actor.uid);
    await resolverSolicitud(uid, aprobar ? "aprobada" : "rechazada", actor.uid, motivo || null);
    return respuesta(200, { ok: true });
  });
}
