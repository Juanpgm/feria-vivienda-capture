import { respuesta } from "@/modules/auth/server/api";
import { conVisita, requireInspector } from "@/modules/mejoramiento/server/api";
import { marcarRegistrada, obtenerVisita, VisitaError } from "@/modules/mejoramiento/server/visitas.repo";
import { verificarObjeto } from "@/shared/s3";

export const runtime = "nodejs";

/** Marks the visit registered once every expected file is in S3 with the declared size and type. */
export function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conVisita(async () => {
    const sesion = await requireInspector();
    const { id } = await ctx.params;
    const v = await obtenerVisita(id);
    if (!v || v.inspector.uid !== sesion.uid) throw new VisitaError(404, "Visita no encontrada");
    if (v.estado === "registrada") return respuesta(200, { ok: true, codigo: v.codigo });

    const estados = await Promise.all(v.archivos.map(async (a) => ({ a, o: await verificarObjeto(a.key) })));
    const faltantes = estados.filter(({ a, o }) => !o || o.bytes !== a.bytes || o.content_type !== a.content_type).map(({ a }) => a.ref);
    if (faltantes.length) throw new VisitaError(409, "Faltan archivos por subir", { faltantes });
    await marcarRegistrada(id);
    return respuesta(200, { ok: true, codigo: v.codigo });
  });
}
