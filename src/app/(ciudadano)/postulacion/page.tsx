import { formularioHabilitado } from "@/modules/postulacion/server/postulaciones.repo";
import { EntradaPostulacion } from "@/modules/postulacion/ui/EntradaPostulacion";
import { Card } from "@/shared/ui/Card";

export const metadata = { title: "Postulación al Subsidio Distrital de Vivienda" };

/** Public form (target of the printed QR, S14). Off unless an admin enabled it (S17). */
export default async function PostulacionPublica() {
  const disponible = await formularioHabilitado();
  return (
    <div className="flex flex-col gap-4 py-2">
      <h1 className="text-2xl font-bold text-primary-strong">Postulación al Subsidio Distrital de Vivienda</h1>
      {disponible ? (
        <EntradaPostulacion uid="publico" publico />
      ) : (
        <Card>
          <p role="status">El formulario de postulación no está disponible en este momento. Intente más tarde.</p>
        </Card>
      )}
    </div>
  );
}
