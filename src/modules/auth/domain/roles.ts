import { ALLOWED_EMAIL_DOMAIN } from "@/shared/config";

export const ROLES = ["usuario", "admin", "superadmin"] as const;
export type Rol = (typeof ROLES)[number];

export const COOKIE_SESION = "sesion";

export const esRol = (v: unknown): v is Rol => ROLES.includes(v as Rol);

/** True when `actual` is at least `minimo` (usuario < admin < superadmin). */
export const tieneRol = (actual: Rol, minimo: Rol) => ROLES.indexOf(actual) >= ROLES.indexOf(minimo);

/** Admin manages only `usuario`; superadmin manages every role. */
export function puedeGestionar(actor: Rol, objetivo: Rol): boolean {
  if (actor === "superadmin") return true;
  return actor === "admin" && objetivo === "usuario";
}

/** Used only by the Google rule: the institutional domain is required for Google sign-in, not for email+password. */
export const correoEnDominio = (correo: string | undefined | null): boolean =>
  !!correo && correo.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);

/**
 * Pages an unapproved (pending) Google session may see; first entry is the landing they are redirected to.
 * "/dashboard" is a placeholder: phase 4 only has to add the page and call the guard with `soloLectura`.
 */
export const RUTAS_SOLO_LECTURA = ["/", "/dashboard"] as const;

export type RechazoAcceso = "dominio" | "no_verificado" | "proveedor";

/**
 * Provider-based admission rule (server-side, from the verified ID token's `firebase.sign_in_provider`).
 * google.com: institutional domain + verified email. password: any domain. Anything else: rejected.
 * Returns null when admitted (approval is still checked separately).
 */
export function rechazoPorProveedor(
  proveedor: string | undefined,
  correo: string | undefined | null,
  emailVerificado: boolean | undefined,
): RechazoAcceso | null {
  if (proveedor === "password") return null;
  if (proveedor !== "google.com") return "proveedor";
  if (!correoEnDominio(correo)) return "dominio";
  return emailVerificado === true ? null : "no_verificado";
}
