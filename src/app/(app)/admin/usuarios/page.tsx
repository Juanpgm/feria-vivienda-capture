import { sesionOLogin } from "@/modules/auth/server/guard";
import { listarUsuarios } from "@/modules/auth/server/usuarios.repo";
import { AprobarBoton } from "@/modules/auth/ui/AprobarBoton";
import { FormCrearUsuario } from "@/modules/auth/ui/FormCrearUsuario";
import { Card } from "@/shared/ui/Card";

export const metadata = { title: "Usuarios | Feria de Vivienda" };

type Fila = Awaited<ReturnType<typeof listarUsuarios>>[number];

const ROL: Record<string, string> = { usuario: "Usuario", admin: "Administrador", superadmin: "Superadministrador" };

function Tabla({ filas, conAccion, vacio }: { filas: Fila[]; conAccion?: boolean; vacio: string }) {
  if (!filas.length) return <p className="text-muted">{vacio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-4 font-semibold">Nombre</th>
            <th className="py-2 pr-4 font-semibold">Correo</th>
            <th className="py-2 pr-4 font-semibold">Rol</th>
            {conAccion && <th className="py-2 font-semibold">Acción</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((u) => (
            <tr key={u.uid} className="border-b border-border last:border-0">
              <td className="py-2 pr-4">{u.nombre}</td>
              <td className="py-2 pr-4">{u.correo}</td>
              <td className="py-2 pr-4">{ROL[u.rol]}</td>
              {conAccion && (
                <td className="py-2">
                  <AprobarBoton uid={u.uid} nombre={u.nombre} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function UsuariosPage() {
  const sesion = await sesionOLogin("admin");
  const usuarios = await listarUsuarios(sesion.rol);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-primary-strong">Usuarios</h1>
      <Card title="Pendientes de aprobación">
        <Tabla
          conAccion
          filas={usuarios.filter((u) => !u.esta_aprobado)}
          vacio="No hay cuentas pendientes. Las cuentas nuevas aparecen aquí cuando alguien se registra con su correo institucional."
        />
      </Card>
      <Card title="Aprobados">
        <Tabla
          filas={usuarios.filter((u) => u.esta_aprobado)}
          vacio="Aún no hay usuarios aprobados. Apruebe una cuenta pendiente o cree un usuario abajo."
        />
      </Card>
      <Card title="Crear usuario">
        <FormCrearUsuario puedeElegirRol={sesion.rol === "superadmin"} />
      </Card>
    </div>
  );
}
