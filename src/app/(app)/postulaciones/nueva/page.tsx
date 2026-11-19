import { sesionOLogin } from "@/modules/auth/server/guard";
import { EntradaPostulacion } from "@/modules/postulacion/ui/EntradaPostulacion";

export const metadata = { title: "Nueva postulación" };

/** Staff entry: same form, works even while the public form is disabled. */
export default async function NuevaPostulacion() {
  const sesion = await sesionOLogin();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-primary-strong">Nueva postulación al subsidio</h1>
      <EntradaPostulacion uid={sesion.uid} publico={false} />
    </div>
  );
}
