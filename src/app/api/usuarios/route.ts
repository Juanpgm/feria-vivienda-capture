import { z } from "zod";
import { ROLES, correoEnDominio, puedeGestionar } from "@/modules/auth/domain/roles";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { crearUsuario } from "@/modules/auth/server/usuarios.repo";
import { adminAuth } from "@/shared/firebase/admin";

const body = z.object({
  correo: z.email().transform((c) => c.trim().toLowerCase()),
  nombre: z.string().trim().min(2),
  // Optional: without a password the user can only sign in with Google.
  password: z.string().min(8).optional(),
  rol: z.enum(ROLES).default("usuario"),
});

export const runtime = "nodejs";

/** Admin creates an already-approved user; only a superadmin may create admins/superadmins. */
export function POST(req: Request) {
  return conErrores(async () => {
    const actor = await requireSesion("admin");
    const datos = body.parse(await req.json().catch(() => ({})));
    // Email+password accounts may use any domain; without a password the person can only use Google, which needs the domain.
    if (!datos.password && !correoEnDominio(datos.correo)) {
      return respuesta(422, { error: "Sin contraseña solo se permiten cuentas @cali.gov.co (ingresan con Google). Defina una contraseña." });
    }
    if (!puedeGestionar(actor.rol, datos.rol)) return respuesta(403, { error: "No puede crear ese rol" });

    const auth = adminAuth();
    const u = await auth.createUser({ email: datos.correo, password: datos.password, displayName: datos.nombre });
    await auth.setCustomUserClaims(u.uid, { rol: datos.rol, aprobado: true });
    await crearUsuario(
      u.uid,
      {
        correo: datos.correo,
        nombre: datos.nombre,
        rol: datos.rol,
        esta_aprobado: true,
        proveedor: datos.password ? "password" : "google",
      },
      actor.uid,
    );
    return respuesta(201, { uid: u.uid });
  });
}
