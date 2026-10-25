import { tieneRol } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { PanelDashboard } from "@/modules/dashboard/ui/PanelDashboard";

export const metadata = { title: "Resumen de registros" };

export default async function Dashboard() {
  // Open to unapproved institutional Google sessions (read-only tier): the API scopes what they get.
  const sesion = await sesionOLogin("usuario", { soloLectura: true });
  return <PanelDashboard admin={sesion.aprobado && tieneRol(sesion.rol, "admin")} />;
}
