import { redirect } from "next/navigation";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { FormularioVisita } from "@/modules/mejoramiento/ui/FormularioVisita";

export const metadata = { title: "Nuevo levantamiento | Feria de Vivienda" };

/** Only the inspector role creates visits; admins see them from /mejoramiento. */
export default async function NuevaVisita() {
  const sesion = await sesionOLogin("inspector");
  if (sesion.rol !== "inspector") redirect("/mejoramiento");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-primary-strong">Nuevo levantamiento de mejoramiento de vivienda</h1>
      <FormularioVisita uid={sesion.uid} />
    </div>
  );
}
