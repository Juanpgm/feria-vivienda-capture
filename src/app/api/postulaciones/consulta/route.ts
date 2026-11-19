import { z } from "zod";
import { respuesta } from "@/modules/auth/server/api";
import { conPostulacion, ipDe, puertaPublica } from "@/modules/postulacion/server/api";
import { consultarPorDocumento, frenoConsulta } from "@/modules/postulacion/server/postulaciones.repo";
import { normalizarDocumento } from "@/shared/normalizacion/texto";

export const runtime = "nodejs";

const body = z.object({ documento: z.string().max(40) });

/**
 * First question of the form (S12): does a postulación exist for this document? The public only learns the radicado and
 * its status (never the data). The public already needs a valid QR code; a generous per-IP brake caps abuse.
 */
export function POST(req: Request) {
  return conPostulacion(async () => {
    const { sesion, rechazo } = await puertaPublica(req);
    if (rechazo) return rechazo;
    if (!sesion && (await frenoConsulta(ipDe(req)))) return respuesta(429, { error: "Demasiadas consultas. Espere unos minutos e intente de nuevo." });
    const documento = normalizarDocumento(body.parse(await req.json().catch(() => ({}))).documento);
    if (!/^[A-Z0-9]{4,20}$/.test(documento)) return respuesta(422, { error: "Escriba un número de documento válido (solo números y letras)." });
    const c = await consultarPorDocumento(documento);
    // Already a member of another household: it cannot apply on its own (the public does not learn which one).
    if (!c.existe && c.integranteDe) return respuesta(200, { existe: false, documento, integrante: true, ...(sesion ? { id: c.integranteDe.id, radicado: c.integranteDe.radicado } : {}) });
    if (!c.existe) return respuesta(200, { existe: false, documento });
    return respuesta(200, { existe: true, documento, radicado: c.radicado, estado: c.estado, ...(sesion ? { id: c.id } : {}) });
  });
}
