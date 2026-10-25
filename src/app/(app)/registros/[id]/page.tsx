import { tieneRol } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { DetalleRegistro } from "@/modules/registro/ui/DetalleRegistro";

export const metadata = { title: "Detalle del registro" };

export default async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionOLogin(); // approved users only; the API enforces who may see which record
  const { id } = await params;
  return <DetalleRegistro id={id} esAdmin={tieneRol(sesion.rol, "admin")} />;
}
