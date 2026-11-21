import Link from "next/link";
import type { ReactNode } from "react";
import { tieneRol } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { obtenerUsuario } from "@/modules/auth/server/usuarios.repo";
import { BotonSalir } from "@/modules/auth/ui/BotonSalir";
import { RegistrarFirma } from "@/modules/mejoramiento/ui/RegistrarFirma";
import { AppShell } from "@/shared/ui/AppShell";

const enlaceNav = "inline-flex min-h-11 items-center rounded-lg px-3 text-base font-semibold text-primary-strong hover:bg-bg lg:text-sm";

export const dynamic = "force-dynamic"; // always check the session cookie

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sesion = await sesionOLogin("usuario", { soloLectura: true }); // pages that need approval guard themselves
  // An inspector without a registered signature sees only the signature pad until it is saved (S8).
  const perfil = sesion.rol === "inspector" ? await obtenerUsuario(sesion.uid) : null;
  const pedirFirma = !!perfil && !perfil.firma_key;
  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-1 lg:flex-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-1">
      <Link href="/dashboard" className={enlaceNav}>
        Dashboard
      </Link>
      {sesion.aprobado && (
        <Link href="/registros" className={enlaceNav}>
          Registros
        </Link>
      )}
      {sesion.aprobado && (
        <Link href="/postulaciones" className={enlaceNav}>
          Postulaciones
        </Link>
      )}
      {tieneRol(sesion.rol, "admin") && (
        <Link href="/admin/usuarios" className={enlaceNav}>
          Usuarios
        </Link>
      )}
      {tieneRol(sesion.rol, "admin") && (
        <Link href="/admin/ciudadanos" className={enlaceNav}>
          Ciudadanos
        </Link>
      )}
      {tieneRol(sesion.rol, "admin") && (
        <Link href="/admin/postulaciones" className={enlaceNav}>
          Formulario postulación
        </Link>
      )}
      {sesion.aprobado && (
        <Link href="/cuenta" className={enlaceNav}>
          Mi cuenta
        </Link>
      )}
      <span className="truncate px-3 pt-2 text-sm text-muted lg:hidden">{sesion.correo}</span>
      <div className="px-3 lg:ml-auto lg:px-0">
        <BotonSalir />
      </div>
    </nav>
  );
  return (
    <AppShell nav={nav} usuario={sesion.correo}>
      {!sesion.aprobado && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm">
          Su cuenta aún no está aprobada: puede consultar, pero no ingresar datos. Cuando un administrador la apruebe,
          cierre sesión e ingrese de nuevo.
        </p>
      )}
      {pedirFirma ? <RegistrarFirma nombre={perfil.nombre} /> : children}
    </AppShell>
  );
}
