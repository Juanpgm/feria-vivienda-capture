import Link from "next/link";
import type { ReactNode } from "react";
import { tieneRol } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { BotonSalir } from "@/modules/auth/ui/BotonSalir";
import { AppShell } from "@/shared/ui/AppShell";

export const dynamic = "force-dynamic"; // always check the session cookie

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sesion = await sesionOLogin();
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
  return <AppShell nav={nav}>{children}</AppShell>;
}
