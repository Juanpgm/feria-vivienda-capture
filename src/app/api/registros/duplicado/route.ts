import { z } from "zod";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { tieneRol } from "@/modules/auth/domain/roles";
import { requireSesion } from "@/modules/auth/server/sesion";
import { buscarDuplicados } from "@/modules/registro/server/registro.repo";
import { TIPOS_DOCUMENTO } from "@/shared/constantes";
import { normalizarDocumento } from "@/shared/normalizacion/texto";

export const runtime = "nodejs";

const paramsSchema = z.object({
  // Informative only: the match ignores tipo_documento on purpose (same number, other tipo, is still a duplicate).
  tipo: z.enum(Object.keys(TIPOS_DOCUMENTO) as [string, ...string[]]).optional().catch(undefined),
  numero: z
    .string({ error: "Ingrese el número de documento" })
    .transform(normalizarDocumento)
    .refine((n) => n.length > 0 && n.length <= 40, "Ingrese un número de documento válido"),
  excluir: z.uuid().optional().catch(undefined),
});

/**
 * Duplicate-document check for step 1. Any approved funcionario learns THAT a record exists plus its radicado and
 * date; only admin+ also learn who registered it and its review status. Never blocks anything.
 */
export function GET(req: Request) {
  return conErrores(async () => {
    const actor = await requireSesion("usuario");
    const p = paramsSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const encontrados = await buscarDuplicados(p.numero, { excluirId: p.excluir });
    const d = encontrados[0];
    if (!d) return respuesta(200, { existe: false });
    return respuesta(200, {
      existe: true,
      coincidencia: d.coincidencia,
      cantidad: encontrados.length,
      radicado: d.radicado,
      fecha_registro_bogota: d.fecha_registro_bogota,
      ...(tieneRol(actor.rol, "admin") ? { registrado_por_nombre: d.registrado_por_nombre, estado_revision: d.estado_revision } : {}),
    });
  });
}
