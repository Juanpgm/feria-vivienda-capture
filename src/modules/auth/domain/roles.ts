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

export const correoEnDominio = (correo: string | undefined | null): boolean =>
  !!correo && correo.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
