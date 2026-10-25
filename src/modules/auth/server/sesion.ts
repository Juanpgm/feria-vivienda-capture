import { cookies } from "next/headers";
import { adminAuth } from "@/shared/firebase/admin";
import { COOKIE_SESION, esRol, tieneRol, type Rol } from "../domain/roles";

export type Sesion = { uid: string; correo: string; rol: Rol };

export class SesionError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** Core gate: verifies the cookie (checking revocation) and the role/approval claims. */
export async function verificarSesion(cookie: string | undefined, rolMinimo: Rol): Promise<Sesion> {
  if (!cookie) throw new SesionError(401, "No autenticado");
  let decoded;
  try {
    decoded = await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    throw new SesionError(401, "Sesión inválida o expirada");
  }
  if (decoded.aprobado !== true || !esRol(decoded.rol)) {
    throw new SesionError(403, "Cuenta pendiente de aprobación");
  }
  if (!tieneRol(decoded.rol, rolMinimo)) throw new SesionError(403, "No tiene permisos");
  return { uid: decoded.uid, correo: decoded.email ?? "", rol: decoded.rol };
}

export async function requireSesion(rolMinimo: Rol = "usuario"): Promise<Sesion> {
  return verificarSesion((await cookies()).get(COOKIE_SESION)?.value, rolMinimo);
}
