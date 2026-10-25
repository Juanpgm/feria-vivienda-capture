import { COOKIE_SESION } from "@/modules/auth/domain/roles";
import { respuesta } from "@/modules/auth/server/api";

export function POST() {
  const res = respuesta(200, { ok: true });
  res.cookies.delete(COOKIE_SESION);
  return res;
}
