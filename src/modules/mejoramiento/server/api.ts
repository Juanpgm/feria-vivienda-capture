import type { NextResponse } from "next/server";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { VisitaError } from "./visitas.repo";

/** Route wrapper: VisitaError -> JSON status; everything else through the shared mapper. */
export const conVisita = (fn: () => Promise<NextResponse>) =>
  conErrores(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof VisitaError) return respuesta(e.status, { error: e.message, ...e.extra });
      throw e;
    }
  });

/** Only the Inspector role registers visits (admins only review them). */
export async function requireInspector() {
  const s = await requireSesion("inspector");
  if (s.rol !== "inspector") throw new VisitaError(403, "Solo un inspector puede registrar visitas");
  return s;
}
