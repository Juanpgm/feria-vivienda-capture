import { z } from "zod";
import { COOKIE_SESION, correoEnDominio } from "@/modules/auth/domain/roles";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { crearUsuario, obtenerUsuario } from "@/modules/auth/server/usuarios.repo";
import { adminAuth } from "@/shared/firebase/admin";

const CINCO_DIAS_MS = 5 * 24 * 3600_000;
const body = z.object({ idToken: z.string().min(10) });

export const runtime = "nodejs";

export function POST(req: Request) {
  return conErrores(async () => {
    const { idToken } = body.parse(await req.json().catch(() => ({})));
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(idToken, true).catch(() => null);
    if (!decoded) return respuesta(401, { error: "Credenciales inválidas" });

    const correo = (decoded.email ?? "").toLowerCase();
    const google = decoded.firebase.sign_in_provider === "google.com";

    // Domain is enforced here (authoritative), not only in the UI.
    if (!correoEnDominio(correo)) {
      await auth.deleteUser(decoded.uid).catch(() => undefined);
      return respuesta(403, { error: "Solo se permiten cuentas @cali.gov.co" });
    }
    if (google && decoded.email_verified !== true) {
      return respuesta(403, { error: "El correo de Google no está verificado" });
    }

    let usuario = await obtenerUsuario(decoded.uid);
    if (!usuario) {
      usuario = {
        correo,
        nombre: decoded.name ?? correo,
        rol: "usuario",
        esta_aprobado: false,
        proveedor: google ? "google" : "password",
      };
      await crearUsuario(decoded.uid, usuario);
    }
    if (!usuario.esta_aprobado) return respuesta(200, { estado: "pendiente" });

    // Token claims lag behind the users doc (e.g. just approved): sync and ask to sign in again.
    if (decoded.aprobado !== true || decoded.rol !== usuario.rol) {
      await auth.setCustomUserClaims(decoded.uid, { rol: usuario.rol, aprobado: true });
      return respuesta(401, { error: "Vuelva a iniciar sesión" });
    }

    const cookie = await auth.createSessionCookie(idToken, { expiresIn: CINCO_DIAS_MS });
    const res = respuesta(200, { estado: "aprobado", rol: usuario.rol });
    res.cookies.set(COOKIE_SESION, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CINCO_DIAS_MS / 1000,
    });
    return res;
  });
}
