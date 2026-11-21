import { z } from "zod";
import { ROLES, permisoSobreUsuario, puedeGestionar } from "@/modules/auth/domain/roles";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { cambiarRol, obtenerUsuario } from "@/modules/auth/server/usuarios.repo";
import { adminAuth } from "@/shared/firebase/admin";

const body = z.object({ rol: z.enum(ROLES) });

export const runtime = "nodejs";

/**
 * Changes an approved account's role. Admin: usuario <-> inspector; superadmin: any. The target's refresh tokens
 * are revoked, so its session cookie stops verifying and the next login carries the new claims.
 */
export function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  return conErrores(async () => {
    const actor = await requireSesion("admin");
    const { uid } = await ctx.params;
    const { rol } = body.parse(await req.json().catch(() => ({})));

    const objetivo = await obtenerUsuario(uid);
    if (!objetivo) return respuesta(404, { error: "Usuario no encontrado" });
    const permiso = permisoSobreUsuario(actor, { uid, rol: objetivo.rol });
    if (permiso === "propia") return respuesta(403, { error: "No puede cambiar su propio rol" });
    if (permiso !== "ok" || !puedeGestionar(actor.rol, rol)) return respuesta(403, { error: "No puede asignar ese rol" });
    if (!objetivo.esta_aprobado) return respuesta(409, { error: "La cuenta aún no está aprobada; apruébela con el rol deseado" });
    if (objetivo.rol === rol) return respuesta(200, { ok: true, sin_cambios: true });

    // Claims and revocation first: if they fail the doc keeps the old role, so a retry is not a "no change" no-op
    // that would leave the old session alive.
    const auth = adminAuth();
    await auth.setCustomUserClaims(uid, { rol, aprobado: true });
    await auth.revokeRefreshTokens(uid); // closes the active session; claims refresh on next login
    await cambiarRol(uid, rol, actor.uid);
    return respuesta(200, { ok: true });
  });
}
