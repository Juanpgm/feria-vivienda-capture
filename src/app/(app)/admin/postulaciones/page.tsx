import { sesionOLogin } from "@/modules/auth/server/guard";
import { formularioHabilitado } from "@/modules/postulacion/server/postulaciones.repo";
import { PanelFormulario } from "@/modules/postulacion/ui/PanelFormulario";
import { Card } from "@/shared/ui/Card";

export const metadata = { title: "Formulario de postulación" };

export default async function AdminPostulaciones() {
  await sesionOLogin("admin");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-primary-strong">Formulario de postulación al subsidio</h1>
      <Card title="Acceso público (código QR)">
        <PanelFormulario inicial={await formularioHabilitado()} />
      </Card>
    </div>
  );
}
