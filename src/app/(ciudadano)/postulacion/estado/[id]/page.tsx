import { notFound, redirect } from "next/navigation";
import { requireSesion } from "@/modules/auth/server/sesion";
import { ESTADOS_POSTULACION } from "@/modules/postulacion/domain/catalogos";
import { estadoPublico } from "@/modules/postulacion/server/postulaciones.repo";

export const metadata = { title: "Estado de la postulación" };

const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Target of the QR of each postulación. A logged-in official goes straight to the record (view and edit); anyone else
 * sees only its radicado and status (decision 2026-11-18: the public never sees the data). The id is an unguessable HMAC.
 */
export default async function EstadoPostulacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (await requireSesion("usuario").then(() => true, () => false)) redirect(`/postulaciones/${id}`);
  const e = await estadoPublico(id);
  if (!e) notFound();
  const valido = e.estado === "valido";
  return (
    <section aria-labelledby="estado-titulo" className="mx-auto flex max-w-lg flex-col gap-6 py-6">
      <div className="overflow-hidden rounded-xl border border-border bg-bg shadow-[0_18px_40px_-24px_rgb(0_54_95/0.55)]">
        <div className="relative bg-[#00365f] px-6 pb-6 pt-5 text-white">
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
          <p className="text-sm text-white/85">Subsidio Distrital de Vivienda</p>
          <h1 id="estado-titulo" className="mt-1 text-xl font-bold">Estado de la postulación</h1>
        </div>
        <div className="flex flex-col gap-5 p-6">
          <div>
            <p className="text-sm text-muted">Número de registro</p>
            <p data-testid="radicado" className="text-4xl font-bold tabular-nums tracking-tight text-primary-strong">{e.radicado}</p>
          </div>
          <p data-testid="estado" className={`self-start rounded-full px-4 py-1.5 font-bold ${valido ? "bg-success text-bg" : "bg-warning-bg text-warning-text"}`}>
            {ESTADOS_POSTULACION[e.estado]}
          </p>
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
            {e.fecha_bogota && (
              <>
                <dt className="text-muted">Registrada el</dt>
                <dd className="font-semibold">{fecha(e.fecha_bogota)}</dd>
              </>
            )}
            {e.validado_en && (
              <>
                <dt className="text-muted">Validada el</dt>
                <dd className="font-semibold">{fecha(e.validado_en.slice(0, 10))}</dd>
              </>
            )}
          </dl>
          <p className="text-sm text-muted">
            {valido
              ? "Un funcionario revisó sus datos y documentos y validó la postulación."
              : "Un funcionario de la Secretaría revisará sus datos y sus documentos. Si necesita corregir algo, acérquese con su documento de identidad."}
          </p>
        </div>
      </div>
    </section>
  );
}
