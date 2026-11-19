import { cookies } from "next/headers";
import { requireSesion } from "@/modules/auth/server/sesion";
import { COOKIE_ACCESO } from "@/modules/postulacion/server/api";
import { formularioHabilitado, verificarAccesoPublico } from "@/modules/postulacion/server/postulaciones.repo";
import { EntradaPostulacion } from "@/modules/postulacion/ui/EntradaPostulacion";
import { Card } from "@/shared/ui/Card";

export const metadata = { title: "Postulación al Subsidio Distrital de Vivienda" };

const MOTIVOS: Record<string, string> = {
  vencido: "El código QR que escaneó ya venció.",
  anulado: "El código QR que escaneó fue reemplazado por uno nuevo.",
  invalido: "El código QR que escaneó no es válido.",
};

/**
 * Public form (S14/S17). Opens only while an admin keeps it enabled AND the browser came from a valid printed QR
 * (or for a logged-in official). The QR leads here through /postulacion/ingreso.
 */
export default async function PostulacionPublica({ searchParams }: { searchParams: Promise<{ acceso?: string }> }) {
  const { acceso } = await searchParams;
  const funcionario = await requireSesion("usuario").then(() => true, () => false);
  const disponible = await formularioHabilitado();
  const permiso = funcionario || (await verificarAccesoPublico((await cookies()).get(COOKIE_ACCESO)?.value)).ok;
  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="relative -mx-4 -mt-4 overflow-hidden bg-[#00365f] px-4 py-6 text-white md:-mx-6 md:-mt-6 md:rounded-b-2xl md:px-10">
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 bg-accent" />
        <p className="text-sm text-white/80">Alcaldía de Santiago de Cali, Secretaría de Vivienda Social y Hábitat</p>
        <h1 className="mt-1 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Postulación al Subsidio Distrital de Vivienda</h1>
        <p className="mt-3 max-w-xl text-white/85">Un formulario de tres pasos para registrar su hogar. Es gratuito y no necesita intermediarios.</p>
      </header>
      {!disponible ? (
        <Card>
          <p role="status">El formulario de postulación no está disponible en este momento. Intente más tarde.</p>
        </Card>
      ) : permiso ? (
        <EntradaPostulacion uid="publico" publico />
      ) : (
        <Card>
          <div role="status" className="flex flex-col gap-2">
            {acceso && MOTIVOS[acceso] && <p className="font-semibold">{MOTIVOS[acceso]}</p>}
            <p>Para postularse, escanee con la cámara de su celular el código QR vigente que encuentra en el punto de atención de la Secretaría de Vivienda Social y Hábitat.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
