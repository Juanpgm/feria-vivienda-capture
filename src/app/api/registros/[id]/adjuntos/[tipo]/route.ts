import { NextResponse } from "next/server";
import { conErrores, respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { TIPOS_ADJUNTO, type TipoAdjunto } from "@/modules/documentos/domain/imagen";
import { leerAdjunto } from "@/modules/documentos/server/adjuntos.repo";

export const runtime = "nodejs";

/** Image bytes for admin/superadmin only (usuario => 403). Each successful read is written to the access log first. */
export function GET(req: Request, ctx: { params: Promise<{ id: string; tipo: string }> }) {
  return conErrores(async () => {
    const actor = await requireSesion("admin");
    const { id, tipo } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !TIPOS_ADJUNTO.includes(tipo as TipoAdjunto)) return respuesta(404, { error: "Adjunto no encontrado" });
    const a = await leerAdjunto(id, tipo as TipoAdjunto, actor, req.headers.get("user-agent") ?? "");
    if (!a) return respuesta(404, { error: "Adjunto no encontrado" });
    return new NextResponse(new Uint8Array(a.datos), {
      headers: {
        "Content-Type": a.mime,
        "Content-Length": String(a.datos.length),
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": `inline; filename="${tipo}"`,
      },
    });
  });
}
