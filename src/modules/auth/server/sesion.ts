import { cookies } from "next/headers";
import { adminAuth } from "@/shared/firebase/admin";
import { COOKIE_SESION, correoEnDominio, esRol, tieneRol, type Rol } from "../domain/roles";

export type Sesion = { uid: string; correo: string; rol: Rol; aprobado: boolean };

export type OpcionesSesion = {
  /**
   * Read-only routes only. Admits an UNAPPROVED session when it comes from Google with an institutional email
   * (role usuario, aprobado=false). Data-entry and admin routes must never set this.
   */
  permitirPendiente?: boolean;
};

export class SesionError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** Core gate: verifies the cookie (checking revocation) and the role/approval claims. */
export async function verificarSesion(
  cookie: string | undefined,
  rolMinimo: Rol,
  { permitirPendiente = false }: OpcionesSesion = {},
): Promise<Sesion> {
  if (!cookie) throw new SesionError(401, "No autenticado");
  let decoded;
  try {
    decoded = await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    throw new SesionError(401, "Sesión inválida o expirada");
  }
  const correo = decoded.email ?? "";
  if (decoded.aprobado !== true || !esRol(decoded.rol)) {
    // Defense in depth: the cookie is only ever issued to pending users who are Google + institutional.
    const lecturaPendiente = permitirPendiente && decoded.firebase?.sign_in_provider === "google.com" && correoEnDominio(correo);
    if (!lecturaPendiente || !tieneRol("usuario", rolMinimo)) throw new SesionError(403, "Cuenta pendiente de aprobación");
    return { uid: decoded.uid, correo, rol: "usuario", aprobado: false };
  }
  if (!tieneRol(decoded.rol, rolMinimo)) throw new SesionError(403, "No tiene permisos");
  return { uid: decoded.uid, correo, rol: decoded.rol, aprobado: true };
}

/** Strict by default: approval required. Pass `{ permitirPendiente: true }` only on read-only routes. */
export async function requireSesion(rolMinimo: Rol = "usuario", opciones?: OpcionesSesion): Promise<Sesion> {
  return verificarSesion((await cookies()).get(COOKIE_SESION)?.value, rolMinimo, opciones);
}
