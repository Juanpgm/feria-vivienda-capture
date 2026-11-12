import { conErrores, respuesta } from "@/modules/auth/server/api";
import { completarCiudadano } from "@/modules/ciudadano/server/registro";
import { requireCiudadano } from "@/modules/ciudadano/server/sesion";

export const runtime = "nodejs";

export function POST() {
  return conErrores(async () => respuesta(200, await completarCiudadano(await requireCiudadano())));
}
