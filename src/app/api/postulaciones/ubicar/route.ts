import { z } from "zod";
import { respuesta } from "@/modules/auth/server/api";
import { geocodificar } from "@/modules/inmueble/server/geocodificar";
import { conPostulacion, puertaPublica } from "@/modules/postulacion/server/api";

export const runtime = "nodejs";

const body = z.object({ direccion: z.string().max(200) });

/** Address -> barrio/comuna/estrato/coordinates via the Alcaldía geocoder (S3). Public only while the form is enabled. */
export function POST(req: Request) {
  return conPostulacion(async () => {
    const { rechazo } = await puertaPublica(req);
    if (rechazo) return rechazo;
    const { direccion } = body.parse(await req.json().catch(() => ({})));
    return respuesta(200, { ubicacion: await geocodificar(direccion) });
  });
}
