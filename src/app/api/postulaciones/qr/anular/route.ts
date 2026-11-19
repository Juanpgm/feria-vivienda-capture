import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { conPostulacion } from "@/modules/postulacion/server/api";
import { anularAccesosQr } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

/** Admin+: voids every QR poster already issued (for a leaked or lost one). */
export function POST() {
  return conPostulacion(async () => {
    await anularAccesosQr(await requireSesion("admin"));
    return respuesta(200, { anulados: true });
  });
}
