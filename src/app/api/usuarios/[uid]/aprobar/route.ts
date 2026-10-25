import { z } from "zod";
import { ROLES, puedeGestionar } from "@/modules/auth/domain/roles";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { aprobarUsuario, obtenerUsuario } from "@/modules/auth/server/usuarios.repo";
import { adminAuth } from "@/shared/firebase/admin";

const body = z.object({ rol: z.enum(ROLES).optional() });

export const runtime = "nodejs";

/** Admin approves `usuario` accounts; admins/role changes require a superadmin. */
export function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  return conErrores(async () => {
    const actor = await requireSesion("admin");
    const { uid } = await ctx.params;
    const { rol: nuevo } = body.parse(await req.json().catch(() => ({})));

    const objetivo = await obtenerUsuario(uid);
    if (!objetivo) return respuesta(404, { error: "Usuario no encontrado" });
    const rol = nuevo ?? objetivo.rol;
    if (!puedeGestionar(actor.rol, objetivo.rol) || !puedeGestionar(actor.rol, rol)) {
      return respuesta(403, { error: "No puede aprobar ese rol" });
    }

    await aprobarUsuario(uid, rol, actor.uid);
    const auth = adminAuth();
    await auth.setCustomUserClaims(uid, { rol, aprobado: true });
    await auth.revokeRefreshTokens(uid); // user must re-login to get new claims
    return respuesta(200, { ok: true });
  });
}
