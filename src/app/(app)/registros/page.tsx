import { tieneRol } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { listarUsuarios } from "@/modules/auth/server/usuarios.repo";
import { ListaRegistros } from "@/modules/registro/ui/ListaRegistros";

export const metadata = { title: "Registros" };

export default async function Registros() {
  const sesion = await sesionOLogin(); // approved users only
  const admin = tieneRol(sesion.rol, "admin");
  // Options of the "Registrado por" filter: admins list the usuarios they manage, superadmins everyone.
  const funcionarios = admin ? (await listarUsuarios(sesion.rol)).map((u) => ({ uid: u.uid, nombre: u.nombre })) : [];
  return <ListaRegistros admin={admin} funcionarios={funcionarios} />;
}
