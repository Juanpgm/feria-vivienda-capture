import { rolesSolicitables, solicitudRolSchema } from "@/modules/auth/domain/perfil";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { crearSolicitudRol, obtenerUsuario } from "@/modules/auth/server/usuarios.repo";

export const runtime = "nodejs";

/** "Solicitar escalada de privilegios": a pending request that an admin/superadmin resolves in Usuarios. */
export function POST(req: Request) {
  return conErrores(async () => {
    const { uid } = await requireSesion("usuario");
    const { rol, motivo } = solicitudRolSchema.parse(await req.json().catch(() => ({})));
    const u = await obtenerUsuario(uid);
    if (!u) return respuesta(404, { error: "Usuario no encontrado" });
    if (!rolesSolicitables(u.rol).includes(rol)) return respuesta(422, { error: "Solo puede solicitar un rol superior al actual" });
    const r = await crearSolicitudRol(uid, { nombre: u.nombre, correo: u.correo, rol_actual: u.rol, rol_solicitado: rol, motivo });
    if (r === "ya_pendiente") return respuesta(409, { error: "Ya tiene una solicitud pendiente" });
    return respuesta(200, { ok: true });
  });
}
