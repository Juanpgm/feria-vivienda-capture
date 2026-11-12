import { z } from "zod";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { guardarRegistroCiudadano, identidadDe } from "@/modules/ciudadano/server/registro";
import { requireCiudadano } from "@/modules/ciudadano/server/sesion";
import { registroSchema } from "@/modules/registro/domain/schema";

export const runtime = "nodejs";

const extra = z.object({ edicion: z.boolean().optional(), valores: z.record(z.string(), z.unknown()).optional() });

/**
 * Creates the citizen registro (or its single edit with `edicion: true`). The identity comes from the eligibility list:
 * name and document in the payload are overwritten. 201/200 ok, 409 already registered / edit used, 422 field errors.
 */
export function POST(req: Request) {
  return conErrores(async () => {
    const c = await requireCiudadano();
    const crudo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { edicion = false, valores = {} } = extra.parse(crudo);
    const datos = registroSchema.parse({ ...crudo, solicitante: { ...(crudo.solicitante as object), ...identidadDe(c) } });
    // Drafts only: the signature image and photo markers are never stored with the form values.
    const { firma: _f, documentos: _d, ...formulario } = valores; // eslint-disable-line @typescript-eslint/no-unused-vars
    if (JSON.stringify(formulario).length > 60_000) return respuesta(413, { error: "Datos demasiado grandes" });
    const r = await guardarRegistroCiudadano(datos, c, edicion, formulario);
    return respuesta(200, r);
  });
}
