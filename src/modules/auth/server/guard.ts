import { cache } from "react";
import { redirect } from "next/navigation";
import { tieneRol, type Rol } from "../domain/roles";
import { SesionError, requireSesion } from "./sesion";

// Cached per request: layout and page share one cookie verification.
const base = cache(async () => {
  try {
    return await requireSesion("usuario");
  } catch (e) {
    if (e instanceof SesionError) return e.status;
    throw e;
  }
});

/** Page guard: sends anonymous users to /login, unapproved ones to /pendiente, under-privileged ones home. */
export async function sesionOLogin(rolMinimo: Rol = "usuario") {
  const s = await base();
  if (s === 401) redirect("/login");
  if (s === 403) redirect("/pendiente");
  if (!tieneRol(s.rol, rolMinimo)) redirect("/");
  return s;
}
