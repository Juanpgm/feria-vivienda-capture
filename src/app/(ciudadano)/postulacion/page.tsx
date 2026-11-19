import { formularioHabilitado } from "@/modules/postulacion/server/postulaciones.repo";
import { EntradaPostulacion } from "@/modules/postulacion/ui/EntradaPostulacion";
import { Card } from "@/shared/ui/Card";

export const metadata = { title: "Postulación al Subsidio Distrital de Vivienda" };

/** Public form (target of the printed QR, S14). Off unless an admin enabled it (S17). */
export default async function PostulacionPublica() {
  const disponible = await formularioHabilitado();
  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="relative -mx-4 -mt-4 overflow-hidden bg-[#00365f] px-4 py-6 text-white md:-mx-6 md:-mt-6 md:rounded-b-2xl md:px-10">
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 bg-accent" />
        <p className="text-sm text-white/80">Alcaldía de Santiago de Cali, Secretaría de Vivienda Social y Hábitat</p>
        <h1 className="mt-1 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Postulación al Subsidio Distrital de Vivienda</h1>
        <p className="mt-3 max-w-xl text-white/85">Un formulario de tres pasos para registrar su hogar. Es gratuito y no necesita intermediarios.</p>
      </header>
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
