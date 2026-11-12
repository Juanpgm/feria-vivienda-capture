import { redirect } from "next/navigation";
import { FormIngreso } from "@/modules/ciudadano/ui/FormIngreso";
import { enlaceHabilitado } from "@/modules/ciudadano/server/ciudadanos.repo";
import { requireCiudadano } from "@/modules/ciudadano/server/sesion";
import { Card } from "@/shared/ui/Card";

export const metadata = { title: "Registro ciudadano | Feria de Vivienda" };

export default async function IngresoCiudadano() {
  if (await requireCiudadano().then(() => true, () => false)) redirect("/ciudadano/registro");
  const disponible = await enlaceHabilitado();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-6">
      <h1 className="text-2xl font-bold text-primary-strong">Registro para bonos de vivienda de emergencia</h1>
      {disponible ? (
        <Card title="Ingresar">
          <p className="mb-4 rounded-lg bg-warning-bg p-3 font-medium text-warning-text">
            Ingrese con su <strong>número de documento de identidad</strong>. Su <strong>contraseña es el mismo número</strong> de documento.
          </p>
          <FormIngreso />
        </Card>
      ) : (
        <Card>
          <p role="status">El registro para ciudadanos no está disponible en este momento. Intente más tarde.</p>
        </Card>
      )}
    </div>
  );
}
