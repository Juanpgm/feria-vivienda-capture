import Link from "next/link";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { Card } from "@/shared/ui/Card";

// Placeholder until the dashboard (phase 4) lands. Read-only landing for pending accounts.
export default async function Inicio() {
  const sesion = await sesionOLogin("usuario", { soloLectura: true });
  return (
    <Card title="Feria de Vivienda">
      <p>Aplicación de captura de datos de la Feria de Vivienda.</p>
      {sesion.aprobado && (
        <Link
          href="/registros/nuevo"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
        >
          Nuevo registro
        </Link>
      )}
    </Card>
  );
}
