// Server-only: access codes of the public form's QR. A code is `<exp>.<version>.<firma>`: it expires at `exp` (unix
// seconds) and belongs to a `version` of the QR series, which an admin can bump to void every code already printed.
// The signature is an HMAC with a key derived from the service account, so codes cannot be forged.
// ponytail: a photo of a valid printed QR still works until it expires or is voided; nothing on a phone camera can
// tell paper from a photo of it.
import { createHmac, timingSafeEqual } from "node:crypto";

export const VIGENCIAS_DIAS = [1, 7, 30] as const;
export type VigenciaDias = (typeof VIGENCIAS_DIAS)[number];

const firma = (secreto: Buffer, exp: number, version: number) => createHmac("sha256", secreto).update(`qr-postulacion:${exp}:${version}`).digest("base64url").slice(0, 32);

export function firmarAcceso(secreto: Buffer, version: number, exp: number): string {
  return `${exp}.${version}.${firma(secreto, exp, version)}`;
}

export type Verificacion = { ok: true; exp: number } | { ok: false; motivo: "invalido" | "vencido" | "anulado" };

export function verificarAcceso(secreto: Buffer, token: string | undefined | null, versionActual: number, ahora = Date.now()): Verificacion {
  const m = /^(\d{10})\.(\d{1,6})\.([A-Za-z0-9_-]{32})$/.exec(token ?? "");
  if (!m) return { ok: false, motivo: "invalido" };
  const exp = Number(m[1]);
  const version = Number(m[2]);
  const esperado = Buffer.from(firma(secreto, exp, version));
  const dado = Buffer.from(m[3]);
  if (esperado.length !== dado.length || !timingSafeEqual(esperado, dado)) return { ok: false, motivo: "invalido" };
  if (version !== versionActual) return { ok: false, motivo: "anulado" };
  if (exp * 1000 <= ahora) return { ok: false, motivo: "vencido" };
  return { ok: true, exp };
}

/** Expiry of a code issued now for `dias` days: end of that day in Bogota (UTC-5), so a poster lasts whole days. */
export function vencimiento(dias: VigenciaDias, ahora = Date.now()): number {
  const bogota = new Date(ahora - 5 * 3600_000);
  const fin = Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate() + dias - 1, 23, 59, 59) + 5 * 3600_000;
  return Math.floor(fin / 1000);
}
