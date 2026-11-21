import { z } from "zod";
import { respuesta } from "@/modules/auth/server/api";
import { actualizarFirma } from "@/modules/auth/server/usuarios.repo";
import { decodificarFirmaPng } from "@/modules/mejoramiento/domain/firmaInspector";
import { claveFirmaInspector } from "@/modules/mejoramiento/domain/fotos";
import { conVisita, requireInspector } from "@/modules/mejoramiento/server/api";
import { VisitaError } from "@/modules/mejoramiento/server/visitas.repo";
import { guardarObjeto } from "@/shared/s3";

export const runtime = "nodejs";

const body = z.object({ firma: z.string().max(400_000) });

/** Registers the inspector's handwritten signature in S3 (inspectores/{uid}/firma.png), used on every visit. */
export function POST(req: Request) {
  return conVisita(async () => {
    const { uid } = await requireInspector();
    const { firma } = body.parse(await req.json().catch(() => ({})));
    const r = decodificarFirmaPng(firma);
    if (!r.ok) throw new VisitaError(422, r.error);
    const key = claveFirmaInspector(uid);
    await guardarObjeto(key, r.bytes, "image/png");
    await actualizarFirma(uid, key);
    return respuesta(200, { ok: true });
  });
}
