import { NextResponse } from "next/server";
import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { leerAdjunto } from "@/modules/documentos/server/adjuntos.repo";
import { conPostulacion, idValido } from "@/modules/postulacion/server/api";
import { pdfPostulacion } from "@/modules/postulacion/server/pdfPostulacion";
import { COLECCION, COLECCION_VALIDACIONES, obtenerPostulacion } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

/**
 * The validated postulación printed on the official format (MMDS01.02.03.P001.F001 v010), for any approved official.
 * Only validated ones: the printout carries the reception by the official (section 7). Signature reads are logged.
 */
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conPostulacion(async () => {
    const actor = await requireSesion("usuario");
    const { id } = await ctx.params;
    const p = idValido(id) ? await obtenerPostulacion(id) : null;
    if (!p) return respuesta(404, { error: "Postulación no encontrada" });
    if (p.estado !== "valido" || !p.validacion) return respuesta(409, { error: "Solo se puede imprimir una postulación validada" });
    const ua = req.headers.get("user-agent") ?? "";
    const [solicitante, funcionario] = await Promise.all([
      p.adjuntos.includes("firma") ? leerAdjunto(id, "firma", actor, ua, COLECCION) : null,
      leerAdjunto(p.validacion.codigo_validacion, "firma", actor, ua, COLECCION_VALIDACIONES),
    ]);
    const pdf = await pdfPostulacion(p, { solicitante, funcionario });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="postulacion-${p.radicado}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
