import { cookies } from "next/headers";
import { COOKIE_CIUDADANO, verificarCookie } from "../domain/cookie";
import { claveCookieCiudadano, enlaceHabilitado, obtenerCiudadano, type Ciudadano } from "./ciudadanos.repo";

export class CiudadanoError extends Error {
  constructor(
    readonly status: 401 | 403 | 404 | 409 | 422,
    message: string,
  ) {
    super(message);
  }
}

/**
 * The citizen gate. Beyond the signed cookie it re-checks, on EVERY request, that the link is enabled and that the
 * document is still in the eligibility list: switching the link off (or removing someone) takes effect immediately.
 */
export async function requireCiudadano(): Promise<Ciudadano> {
  const documento = verificarCookie((await cookies()).get(COOKIE_CIUDADANO)?.value, claveCookieCiudadano());
  if (!documento) throw new CiudadanoError(401, "Sesión inválida o expirada");
  if (!(await enlaceHabilitado())) throw new CiudadanoError(403, "El registro para ciudadanos no está disponible en este momento");
  const c = await obtenerCiudadano(documento);
  if (!c) throw new CiudadanoError(401, "Sesión inválida o expirada");
  return c;
}
