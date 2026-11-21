import Link from "next/link";
import { tieneRol } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { PanelDashboard } from "@/modules/dashboard/ui/PanelDashboard";
import { IconoFlechaDerecha } from "@/shared/ui/Iconos";

export const metadata = { title: "Resumen de registros" };

export default async function Dashboard() {
  // Open to unapproved institutional Google sessions (read-only tier): the API scopes what they get.
  const sesion = await sesionOLogin("usuario", { soloLectura: true });
  return (
    <>
      {sesion.aprobado && (
        <Link href="/dashboard/postulaciones" className="mb-4 inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold text-primary-strong">
          Ver métricas de postulaciones al subsidio <IconoFlechaDerecha className="ml-1 size-4 align-[-2px]" />
        </Link>
      )}
      <PanelDashboard admin={sesion.aprobado && tieneRol(sesion.rol, "admin")} superadmin={sesion.aprobado && sesion.rol === "superadmin"} />
    </>
  );
}
