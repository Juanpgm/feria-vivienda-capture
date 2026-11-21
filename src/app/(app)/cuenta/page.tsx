import { rolesSolicitables } from "@/modules/auth/domain/perfil";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { obtenerSolicitud, obtenerUsuario } from "@/modules/auth/server/usuarios.repo";
import { MiCuenta } from "@/modules/auth/ui/MiCuenta";

export const metadata = { title: "Mi cuenta | Feria de Vivienda" };

export default async function CuentaPage() {
  const sesion = await sesionOLogin("usuario");
  const [u, solicitud] = await Promise.all([obtenerUsuario(sesion.uid), obtenerSolicitud(sesion.uid)]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-primary-strong">Mi cuenta</h1>
      <MiCuenta
        d={{
          correo: sesion.correo,
          rol: sesion.rol,
          proveedor: u?.proveedor ?? "password",
          nombre: u?.nombre ?? "",
          celular: u?.celular ?? null,
          cedula: u?.cedula ?? null,
          cargo: u?.cargo ?? null,
          solicitud: solicitud && { rol_solicitado: solicitud.rol_solicitado, motivo: solicitud.motivo },
          solicitables: rolesSolicitables(sesion.rol),
        }}
      />
    </div>
  );
}
