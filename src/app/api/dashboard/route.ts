import { tieneRol } from "@/modules/auth/domain/roles";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { filtrosSchema } from "@/modules/dashboard/domain/filtros";
import { obtenerDashboard } from "@/modules/dashboard/server/dashboard.repo";

export const runtime = "nodejs";

/**
 * Aggregated counts only, never records. Scope by role: admin+ everything (filters apply), approved usuario their own
 * count plus the global totals, unapproved institutional Google session (read-only) the global totals.
 */
export function GET(req: Request) {
  return conErrores(async () => {
    const sesion = await requireSesion("usuario", { permitirPendiente: true });
    const filtros = filtrosSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const alcance = !sesion.aprobado ? "lectura" : tieneRol(sesion.rol, "admin") ? "completo" : "usuario";
    return respuesta(200, { ...(await obtenerDashboard({ alcance, uid: sesion.uid, filtros })) });
  });
}
