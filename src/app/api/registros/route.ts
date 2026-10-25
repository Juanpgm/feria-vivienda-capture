import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { filtrosSchema } from "@/modules/registro/domain/listado";
import { registroSchema } from "@/modules/registro/domain/schema";
import { crearRegistro, listarRegistros, RegistroConflictoError } from "@/modules/registro/server/registro.repo";
import { radicadoPrefijo } from "@/shared/config";

export const runtime = "nodejs";

/** Any approved staff may register. 201 created, 200 idempotent retry, 422 field errors, 409 id in use. */
export function POST(req: Request) {
  return conErrores(async () => {
    const actor = await requireSesion("usuario");
    const datos = registroSchema.parse(await req.json().catch(() => ({})));
    try {
      const r = await crearRegistro(datos, actor);
      return respuesta(r.creado ? 201 : 200, r);
    } catch (e) {
      if (e instanceof RegistroConflictoError) return respuesta(409, { error: "El identificador del registro ya está en uso" });
      throw e;
    }
  });
}

/**
 * List/search, newest first (alphabetical when searching by name), cursor paginated. Approved users only;
 * `usuario` is scoped to their own registros, admin+ see all. Only whitelisted columns are returned.
 */
export function GET(req: Request) {
  return conErrores(async () => {
    const actor = await requireSesion("usuario");
    const filtros = filtrosSchema(radicadoPrefijo()).parse(Object.fromEntries(new URL(req.url).searchParams));
    try {
      return respuesta(200, await listarRegistros(filtros, actor));
    } catch (e) {
      // FAILED_PRECONDITION: the filter combination needs a composite index that is not deployed (see firestore.indexes.json).
      if ((e as { code?: unknown }).code === 9) {
        console.error("registros: falta un índice compuesto", (e as Error).message);
        return respuesta(400, { error: "Esa combinación de filtros no está disponible" });
      }
      throw e;
    }
  });
}
