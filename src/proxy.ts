import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/modules/auth/domain/roles";

const PUBLICAS = ["/login", "/registro", "/pendiente"];

// Presence-only guard for pages. Real verification happens in requireSesion (node runtime).
// API routes are excluded: they answer 401/403 JSON themselves.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (req.cookies.has(COOKIE_SESION) || PUBLICAS.includes(pathname)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|icon.svg|favicon.ico).*)"],
};
