import { z } from "zod";
import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { claveCroquis, MAX_BYTES_ARCHIVO, MAX_CROQUIS, TIPOS_CROQUIS } from "@/modules/mejoramiento/domain/fotos";
import { conVisita } from "@/modules/mejoramiento/server/api";
import { alcanceDe } from "@/modules/mejoramiento/server/listado";
import { reservarCroquis } from "@/modules/mejoramiento/server/visitas.repo";
import { firmarSubida } from "@/shared/s3";

export const runtime = "nodejs";

const body = z.object({
  archivos: z
    .array(z.object({ ref: z.string().regex(/^[A-Za-z0-9-]{1,60}$/), content_type: z.enum(TIPOS_CROQUIS), bytes: z.number().int().positive().max(MAX_BYTES_ARCHIVO) }))
    .min(1, "Seleccione al menos un archivo")
    .max(MAX_CROQUIS, `Máximo ${MAX_CROQUIS} archivos de croquis por visita`)
    .refine((a) => new Set(a.map((x) => x.ref)).size === a.length, "Hay archivos repetidos"),
});

/**
 * Starts the croquis upload of a registered visit without croquis (owning inspector, admin or superadmin): the
 * server names every key and returns one presigned PUT per file.
 */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conVisita(async () => {
    const sesion = await requireSesion("inspector");
    const { id } = await ctx.params;
    const { archivos } = body.parse(await req.json().catch(() => ({})));
    const r = await reservarCroquis(id, alcanceDe(sesion), (codigo) =>
      archivos.map((a, i) => ({ ref: a.ref, content_type: a.content_type, bytes: a.bytes, key: claveCroquis(codigo, i + 1, a.content_type) })),
    );
    const subidas = await Promise.all(r.croquis.map(async (c) => ({ ref: c.ref, ...(await firmarSubida(c.key, c.content_type, c.bytes)) })));
    return respuesta(200, { codigo: r.codigo, subidas });
  });
}
