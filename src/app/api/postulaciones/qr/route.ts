import { z } from "zod";
import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { VIGENCIAS_DIAS } from "@/modules/postulacion/server/accesoQr";
import { conPostulacion } from "@/modules/postulacion/server/api";
import { emitirAccesoQr } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

const body = z.object({ dias: z.union(VIGENCIAS_DIAS.map((d) => z.literal(d)) as [z.ZodLiteral<1>, z.ZodLiteral<7>, z.ZodLiteral<30>]) });

/** An approved official issues the access code printed in the QR poster, valid for 1, 7 or 30 days. */
export function POST(req: Request) {
  return conPostulacion(async () => {
    await requireSesion("usuario");
    const { dias } = body.parse(await req.json().catch(() => ({})));
    return respuesta(200, await emitirAccesoQr(dias));
  });
}
