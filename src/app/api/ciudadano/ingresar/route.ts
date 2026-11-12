import { z } from "zod";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { COOKIE_CIUDADANO, DURACION_SESION_MS, firmarSesion } from "@/modules/ciudadano/domain/cookie";
import { claveCookieCiudadano, enlaceHabilitado, ipBloqueada, obtenerCiudadano, registrarFallo } from "@/modules/ciudadano/server/ciudadanos.repo";
import { normalizarDocumento } from "@/shared/normalizacion/texto";

export const runtime = "nodejs";

const body = z.object({ documento: z.string().max(40), clave: z.string().max(40) });
const ERROR_GENERICO = "No pudimos ingresar. Revise que su número de documento esté bien escrito: la contraseña es el mismo número.";

/**
 * Citizen login: document + password, where the password IS the document. The eligibility list is the real gate, so the
 * answer never says whether a document is on it, and failures are counted per IP.
 */
export function POST(req: Request) {
  return conErrores(async () => {
    const { documento, clave } = body.parse(await req.json().catch(() => ({})));
    // Vercel sets x-forwarded-for itself; the first entry is the client.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";
    if (await ipBloqueada(ip)) return respuesta(429, { error: "Demasiados intentos. Espere unos minutos e intente de nuevo." });
    if (!(await enlaceHabilitado())) return respuesta(403, { error: "El registro para ciudadanos no está disponible en este momento." });

    const doc = normalizarDocumento(documento);
    const ciudadano = doc && doc === normalizarDocumento(clave) ? await obtenerCiudadano(doc) : null;
    if (!ciudadano) {
      await registrarFallo(ip);
      return respuesta(401, { error: ERROR_GENERICO });
    }
    const res = respuesta(200, { nombre: ciudadano.nombre });
    res.cookies.set(COOKIE_CIUDADANO, firmarSesion(doc, claveCookieCiudadano()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACION_SESION_MS / 1000,
    });
    return res;
  });
}
