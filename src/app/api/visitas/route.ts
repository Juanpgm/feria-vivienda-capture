import { z } from "zod";
import { respuesta } from "@/modules/auth/server/api";
import { obtenerUsuario } from "@/modules/auth/server/usuarios.repo";
import limites from "@/modules/mejoramiento/catalogo/limites.json";
import { archivoSchema, planearArchivos, ubicacionSchema } from "@/modules/mejoramiento/domain/envio";
import { ubicar, type Limites } from "@/modules/mejoramiento/domain/geo";
import { MAX_FOTOS_VISITA } from "@/modules/mejoramiento/domain/fotos";
import { armarPresupuesto, visitaSchema } from "@/modules/mejoramiento/domain/visita";
import { conVisita, requireInspector } from "@/modules/mejoramiento/server/api";
import { apusPorItem } from "@/modules/mejoramiento/server/apus.repo";
import { crearVisita, VisitaError } from "@/modules/mejoramiento/server/visitas.repo";
import { firmarSubida, verificarObjeto } from "@/shared/s3";

export const runtime = "nodejs";

const body = z.object({
  visita: visitaSchema,
  ubicacion: ubicacionSchema,
  archivos: z.array(archivoSchema).max(MAX_FOTOS_VISITA + 1),
});

/**
 * Registers a visit: validates everything, prices the rows from APUS, locates comuna/barrio from the coordinate,
 * takes the MV code and returns one presigned PUT per file. Idempotent by visita.id.
 */
export function POST(req: Request) {
  return conVisita(async () => {
    const sesion = await requireInspector();
    const { visita, ubicacion, archivos } = body.parse(await req.json().catch(() => ({})));

    const perfil = await obtenerUsuario(sesion.uid);
    if (!perfil?.firma_key) throw new VisitaError(409, "Registre su firma antes de enviar visitas", { requiere_firma: true });

    const plan = planearArchivos("MV-000000", visita, archivos);
    if (!plan.ok) throw new VisitaError(422, plan.errores[0], { errores: plan.errores });

    const presupuesto = armarPresupuesto(visita.capitulos, await apusPorItem());
    if (presupuesto.desconocidos.length)
      throw new VisitaError(422, `Actividades que no están en el listado de APUs: ${presupuesto.desconocidos.join(", ")}`);

    const { capitulos: _entrada, ...resto } = visita;
    void _entrada;
    const r = await crearVisita(
      visita.id,
      {
        ...resto,
        capitulos: presupuesto.capitulos,
        costo_directo_total: presupuesto.costo_directo_total,
        ubicacion: { ...ubicacion, ...ubicar(limites as unknown as Limites, ubicacion.lon, ubicacion.lat) },
        inspector: { uid: sesion.uid, nombre: perfil.nombre, correo: sesion.correo, cargo: perfil.cargo ?? null, firma_key: perfil.firma_key },
      },
      (codigo) => {
        const p = planearArchivos(codigo, visita, archivos);
        if (!p.ok) throw new VisitaError(422, p.errores[0]);
        return p.archivos;
      },
    );
    // On a retry, files that already reached S3 intact are not uploaded again (spotty field connections).
    const pendientes = r.reintento
      ? (await Promise.all(r.archivos.map(async (a) => ({ a, o: await verificarObjeto(a.key) })))).filter(({ a, o }) => !o || o.bytes !== a.bytes || o.content_type !== a.content_type).map(({ a }) => a)
      : r.archivos;
    const subidas = await Promise.all(pendientes.map(async (a) => ({ ref: a.ref, ...(await firmarSubida(a.key, a.content_type, a.bytes)) })));
    return respuesta(200, { id: visita.id, codigo: r.codigo, registrada: r.registrada, subidas });
  });
}
