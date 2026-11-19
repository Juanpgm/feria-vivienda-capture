import { NextResponse } from "next/server";
import { respuesta } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { TIPOS_ADJUNTO, type TipoAdjunto } from "@/modules/documentos/domain/imagen";
import { leerAdjunto } from "@/modules/documentos/server/adjuntos.repo";
import { conPostulacion, idValido } from "@/modules/postulacion/server/api";
import { COLECCION, COLECCION_VALIDACIONES } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

/**
 * Image of a postulación for any approved official (decision 2026-11-18). Each read is logged first.
 * `?validacion=<codigo>` serves the official's signature of that validation instead.
 */
export function GET(req: Request, ctx: { params: Promise<{ id: string; tipo: string }> }) {
  return conPostulacion(async () => {
    const actor = await requireSesion("usuario");
    const { id, tipo } = await ctx.params;
    const codigo = new URL(req.url).searchParams.get("validacion");
    if (!idValido(id) || !TIPOS_ADJUNTO.includes(tipo as TipoAdjunto) || (codigo !== null && !/^VAL-\d{6}-[A-Z0-9]{6}$/.test(codigo)))
      return respuesta(404, { error: "Adjunto no encontrado" });
    const ua = req.headers.get("user-agent") ?? "";
    const a = codigo ? await leerAdjunto(codigo, "firma", actor, ua, COLECCION_VALIDACIONES) : await leerAdjunto(id, tipo as TipoAdjunto, actor, ua, COLECCION);
    if (!a) return respuesta(404, { error: "Adjunto no encontrado" });
    return new NextResponse(new Uint8Array(a.datos), {
      headers: {
        "Content-Type": a.mime,
        "Content-Length": String(a.datos.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });
}
