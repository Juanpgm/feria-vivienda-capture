import { conErrores } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { listarApus } from "@/modules/mejoramiento/server/apus.repo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Whole APU catalogue (~3.8k rows): the visit form searches it locally. Inspectors and above. */
export function GET() {
  return conErrores(async () => {
    await requireSesion("inspector");
    const apus = await listarApus();
    return NextResponse.json({ apus }, { headers: { "Cache-Control": "private, max-age=600" } });
  });
}
