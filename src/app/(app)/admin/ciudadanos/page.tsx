import { sesionOLogin } from "@/modules/auth/server/guard";
import { enlaceHabilitado, resumenCiudadanos } from "@/modules/ciudadano/server/ciudadanos.repo";
import { PanelEnlace } from "@/modules/ciudadano/ui/PanelEnlace";
import { Card } from "@/shared/ui/Card";

export const metadata = { title: "Enlace ciudadano | Feria de Vivienda" };

export default async function CiudadanosPage() {
  await sesionOLogin("admin");
  const [habilitado, resumen] = await Promise.all([enlaceHabilitado(), resumenCiudadanos()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-primary-strong">Registro de ciudadanos</h1>
      <Card title="Enlace de autogestión">
        <PanelEnlace inicial={habilitado} {...resumen} />
      </Card>
    </div>
  );
}
