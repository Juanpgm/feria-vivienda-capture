// Signed, stateless citizen session cookie: base64url(payload).base64url(hmac). Pure: the key is passed in.
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_CIUDADANO = "sesion_ciudadano";
export const DURACION_SESION_MS = 8 * 3600_000;

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const firma = (clave: Buffer, datos: string) => createHmac("sha256", clave).update(datos).digest();

export function firmarSesion(documento: string, clave: Buffer, ahora = Date.now()): string {
  const carga = b64(JSON.stringify({ d: documento, e: ahora + DURACION_SESION_MS }));
  return `${carga}.${b64(firma(clave, carga))}`;
}

/** Returns the documento, or null when the cookie is malformed, forged or expired. */
export function verificarCookie(valor: string | undefined, clave: Buffer, ahora = Date.now()): string | null {
  const [carga, sig, resto] = (valor ?? "").split(".");
  if (!carga || !sig || resto !== undefined) return null;
  const esperada = firma(clave, carga);
  const recibida = Buffer.from(sig, "base64url");
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
  try {
    const { d, e } = JSON.parse(Buffer.from(carga, "base64url").toString());
    return typeof d === "string" && d && typeof e === "number" && e > ahora ? d : null;
  } catch {
    return null;
  }
}
