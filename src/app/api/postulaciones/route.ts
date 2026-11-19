import { respuesta } from "@/modules/auth/server/api";
import { conPostulacion, puertaPublica } from "@/modules/postulacion/server/api";
import { entradaCreacion, MAX_CUERPO } from "@/modules/postulacion/server/entrada";
import { crearPostulacion } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

/** Creates a postulación: data, ID photos and signature in one request (public while the form is enabled, or staff). */
export function POST(req: Request) {
  return conPostulacion(async () => {
    const { sesion, rechazo } = await puertaPublica(req);
    if (rechazo) return rechazo;
    if (Number(req.headers.get("content-length") ?? 0) > MAX_CUERPO) return respuesta(413, { error: "El envío es demasiado grande. Tome las fotos de nuevo." });
    const envio = entradaCreacion(await req.json().catch(() => ({})));
    return respuesta(201, await crearPostulacion(envio, sesion));
  });
}
