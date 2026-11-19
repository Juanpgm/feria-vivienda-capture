import type { NextResponse } from "next/server";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion, type Sesion } from "@/modules/auth/server/sesion";
import { AdjuntoError } from "@/modules/documentos/server/adjuntos.repo";
import { formularioHabilitado, PostulacionError, verificarAccesoPublico } from "./postulaciones.repo";

/** conErrores + the module's own errors (status and extra fields such as `campos`, `radicado`, `faltantes`). */
export const conPostulacion = (fn: () => Promise<NextResponse>) =>
  conErrores(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof PostulacionError) return respuesta(e.status, { error: e.message, ...e.extra });
      if (e instanceof AdjuntoError) return respuesta(e.status, { error: e.message });
      throw e;
    }
  });

/** The staff session when there is a valid one; null for the public. */
export const sesionOpcional = (): Promise<Sesion | null> => requireSesion("usuario").catch(() => null);

export const COOKIE_ACCESO = "acceso_postulacion";

/** Why a public request is refused: the form is off, or the browser did not come from a valid QR. */
const MENSAJE_SIN_ACCESO = "Para postularse, escanee el código QR vigente en el punto de atención de la Secretaría de Vivienda.";

/**
 * Public routes of the form (lookup, address, create): an approved official passes; anyone else needs the form enabled
 * AND the access permission left by a valid QR. Returns the refusal, or null to continue.
 */
export async function puertaPublica(req: Request): Promise<{ sesion: Sesion | null; rechazo: NextResponse | null }> {
  const sesion = await sesionOpcional();
  if (sesion) return { sesion, rechazo: null };
  if (!(await formularioHabilitado())) return { sesion, rechazo: respuesta(403, { error: "El formulario de postulación no está disponible en este momento." }) };
  const token = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${COOKIE_ACCESO}=([^;]+)`))?.[1];
  if (!(await verificarAccesoPublico(token ? decodeURIComponent(token) : null)).ok) return { sesion, rechazo: respuesta(403, { error: MENSAJE_SIN_ACCESO }) };
  return { sesion, rechazo: null };
}

/** Client IP (Vercel sets x-forwarded-for; the first entry is the client). */
export const ipDe = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";

export const idValido = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
