import { z } from "zod";
import { COOKIE_SESION, rechazoPorProveedor } from "@/modules/auth/domain/roles";
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

    // Admission is decided here (authoritative) from the provider in the verified token, not the UI.
    const rechazo = rechazoPorProveedor(decoded.firebase.sign_in_provider, correo, decoded.email_verified);
    if (rechazo === "dominio") {
      await auth.deleteUser(decoded.uid).catch(() => undefined);
      return respuesta(403, { error: "El acceso con Google solo está disponible para cuentas @cali.gov.co" });
    }
    if (rechazo === "no_verificado") {
      return respuesta(403, { error: "El correo de Google no está verificado" });
    }
    if (rechazo) return respuesta(403, { error: "Método de acceso no permitido" });

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
    // Unapproved: password accounts get no cookie; Google+institutional ones get a read-only session
    // (requireSesion stays strict, so every data-entry route still rejects them).
    if (!usuario.esta_aprobado && !google) return respuesta(200, { estado: "pendiente" });

    // Token claims lag behind the users doc (e.g. just approved): sync and ask to sign in again.
    if (usuario.esta_aprobado && (decoded.aprobado !== true || decoded.rol !== usuario.rol)) {
      await auth.setCustomUserClaims(decoded.uid, { rol: usuario.rol, aprobado: true });
      return respuesta(401, { error: "Vuelva a iniciar sesión" });
    }

    const cookie = await auth.createSessionCookie(idToken, { expiresIn: CINCO_DIAS_MS });
    const res = respuesta(200, { estado: usuario.esta_aprobado ? "aprobado" : "lectura", rol: usuario.rol });
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
