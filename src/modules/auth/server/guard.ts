import { cache } from "react";
import { redirect } from "next/navigation";
import { RUTAS_SOLO_LECTURA, tieneRol, type Rol } from "../domain/roles";
import { SesionError, requireSesion } from "./sesion";

// Cached per request: layout and page share one cookie verification.
const base = cache(async () => {
  try {
    return await requireSesion("usuario", { permitirPendiente: true });
  } catch (e) {
    if (e instanceof SesionError) return e.status;
    throw e;
  }
});

/**
 * Page guard: anonymous -> /login; no usable session -> /pendiente; under-privileged -> home.
 * Pending (unapproved Google) sessions are sent to the read-only landing unless the page opts in with `soloLectura`.
 */
export async function sesionOLogin(rolMinimo: Rol = "usuario", { soloLectura = false } = {}) {
  const s = await base();
  if (s === 401) redirect("/login");
  if (s === 403) redirect("/pendiente");
  if (!s.aprobado && !soloLectura) redirect(RUTAS_SOLO_LECTURA[0]);
  if (!tieneRol(s.rol, rolMinimo)) redirect("/");
  return s;
}
