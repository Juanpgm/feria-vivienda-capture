import Link from "next/link";
import type { ReactNode } from "react";
import { tieneRol } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { BotonSalir } from "@/modules/auth/ui/BotonSalir";
import { AppShell } from "@/shared/ui/AppShell";

export const dynamic = "force-dynamic"; // always check the session cookie

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sesion = await sesionOLogin("usuario", { soloLectura: true }); // pages that need approval guard themselves
  const nav = (
    <nav aria-label="Principal" className="flex flex-wrap items-center gap-2">
      {tieneRol(sesion.rol, "admin") && (
        <Link
          href="/admin/usuarios"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-primary-strong hover:bg-bg"
        >
          Usuarios
        </Link>
      )}
      <span className="hidden text-sm text-muted md:inline">{sesion.correo}</span>
      <BotonSalir />
    </nav>
  );
  return (
    <AppShell nav={nav}>
      {!sesion.aprobado && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm">
          Su cuenta aún no está aprobada: puede consultar, pero no ingresar datos. Cuando un administrador la apruebe,
          cierre sesión e ingrese de nuevo.
        </p>
      )}
      {children}
    </AppShell>
  );
}
