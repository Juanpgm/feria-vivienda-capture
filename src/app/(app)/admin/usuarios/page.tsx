import { rolesAsignables } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { PanelUsuarios } from "@/modules/auth/ui/PanelUsuarios";

export const metadata = { title: "Usuarios | Feria de Vivienda" };

export default async function UsuariosPage() {
  const sesion = await sesionOLogin("admin");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-primary-strong">Usuarios</h1>
      <PanelUsuarios roles={rolesAsignables(sesion.rol)} uidActual={sesion.uid} />
    </div>
  );
}
