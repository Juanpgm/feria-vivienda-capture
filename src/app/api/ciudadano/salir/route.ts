import { respuesta } from "@/modules/auth/server/api";
import { COOKIE_CIUDADANO } from "@/modules/ciudadano/domain/cookie";

export const runtime = "nodejs";

export function POST() {
  const res = respuesta(200, { ok: true });
  res.cookies.set(COOKIE_CIUDADANO, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
