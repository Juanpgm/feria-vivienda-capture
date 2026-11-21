import { perfilSchema } from "@/modules/auth/domain/perfil";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { actualizarPerfil } from "@/modules/auth/server/usuarios.repo";

export const runtime = "nodejs";

/** The signed-in person edits their own name, mobile, ID number and position (never someone else's). */
export function POST(req: Request) {
  return conErrores(async () => {
    const { uid } = await requireSesion("usuario");
    const perfil = perfilSchema.parse(await req.json().catch(() => ({})));
    await actualizarPerfil(uid, perfil);
    return respuesta(200, { ok: true, perfil });
  });
}
