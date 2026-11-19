import type { NextResponse } from "next/server";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion, type Sesion } from "@/modules/auth/server/sesion";
import { AdjuntoError } from "@/modules/documentos/server/adjuntos.repo";
import { PostulacionError } from "./postulaciones.repo";

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

/** Client IP (Vercel sets x-forwarded-for; the first entry is the client). */
export const ipDe = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";

export const idValido = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
