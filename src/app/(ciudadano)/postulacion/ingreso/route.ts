import { NextResponse } from "next/server";
import { COOKIE_ACCESO } from "@/modules/postulacion/server/api";
import { validarCodigoQr } from "@/modules/postulacion/server/postulaciones.repo";

export const runtime = "nodejs";

/**
 * Target of the printed QR. A valid code leaves a short-lived access permission in this browser (until the code
 * expires) and sends the person to the form, so the code never stays in the address bar to be copied.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const v = await validarCodigoQr(url.searchParams.get("t"));
  if (!v.ok) return NextResponse.redirect(new URL(`/postulacion?acceso=${v.motivo}`, url));
  const res = NextResponse.redirect(new URL("/postulacion", url));
  res.cookies.set(COOKIE_ACCESO, url.searchParams.get("t") ?? "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, v.exp - Math.floor(Date.now() / 1000)),
  });
  return res;
}
