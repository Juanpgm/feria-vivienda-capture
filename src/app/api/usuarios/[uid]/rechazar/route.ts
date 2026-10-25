import { z } from "zod";
import { MOTIVO_MAX, permisoSobreUsuario } from "@/modules/auth/domain/roles";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { obtenerUsuario, rechazarUsuario } from "@/modules/auth/server/usuarios.repo";
import { adminAuth } from "@/shared/firebase/admin";

const body = z.object({ motivo: z.string().trim().max(MOTIVO_MAX).optional() });

export const runtime = "nodejs";

/**
 * "No aprobar": same role rules as approval, and nobody acts on their own account. Keeps the doc and the Auth
 * user (history); only revokes access. Idempotent: repeating it re-applies the claims without a second audit entry.
 */
export function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  return conErrores(async () => {
    const actor = await requireSesion("admin");
    const { uid } = await ctx.params;
    const { motivo } = body.parse(await req.json().catch(() => ({})));

    const objetivo = await obtenerUsuario(uid);
    if (!objetivo) return respuesta(404, { error: "Usuario no encontrado" });
    const permiso = permisoSobreUsuario({ uid: actor.uid, rol: actor.rol }, { uid, rol: objetivo.rol });
    if (permiso === "propia") return respuesta(403, { error: "No puede cambiar el estado de su propia cuenta" });
    if (permiso === "rol") return respuesta(403, { error: "No puede cambiar el estado de ese rol" });

    const resultado = await rechazarUsuario(uid, { uid: actor.uid, correo: actor.correo }, motivo);
    if (resultado === "no_existe") return respuesta(404, { error: "Usuario no encontrado" });
    if (resultado === "aprobado") return respuesta(409, { error: "La cuenta ya está aprobada y no se puede marcar como no aprobada" });

    const auth = adminAuth();
    await auth.setCustomUserClaims(uid, { aprobado: false });
    await auth.revokeRefreshTokens(uid); // drops any live session, including the read-only Google one
    return respuesta(200, { ok: true, ya_rechazado: resultado === "ya_rechazado" });
  });
}
