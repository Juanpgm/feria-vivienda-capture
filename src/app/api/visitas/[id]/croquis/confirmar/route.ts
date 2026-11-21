import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { conVisita } from "@/modules/mejoramiento/server/api";
import { alcanceDe } from "@/modules/mejoramiento/server/listado";
import { guardarCroquis, obtenerVisita, visible, VisitaError } from "@/modules/mejoramiento/server/visitas.repo";
import { verificarObjeto } from "@/shared/s3";

export const runtime = "nodejs";

/** Marks the croquis loaded once every pending file is in S3 with the declared size and type. */
export function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conVisita(async () => {
    const sesion = await requireSesion("inspector");
    const { id } = await ctx.params;
    const v = await obtenerVisita(id);
    if (!v || !visible(v, alcanceDe(sesion))) throw new VisitaError(404, "Visita no encontrada");
    if (v.tiene_croquis) return respuesta(200, { ok: true, tiene_croquis: true });
    const pendientes = v.croquis_pendiente ?? [];
    if (!pendientes.length) throw new VisitaError(409, "No hay croquis por confirmar");

    const estados = await Promise.all(pendientes.map(async (a) => ({ a, o: await verificarObjeto(a.key) })));
    const faltantes = estados.filter(({ a, o }) => !o || o.bytes !== a.bytes || o.content_type !== a.content_type).map(({ a }) => a.ref);
    if (faltantes.length) throw new VisitaError(409, "Faltan archivos de croquis por subir", { faltantes });
    await guardarCroquis(id, pendientes, sesion.uid);
    return respuesta(200, { ok: true, tiene_croquis: true });
  });
}
