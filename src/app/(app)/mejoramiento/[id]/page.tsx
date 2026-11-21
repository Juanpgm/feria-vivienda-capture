import Link from "next/link";
import { notFound } from "next/navigation";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { detalleVisible } from "@/modules/mejoramiento/server/listado";
import { DetalleVisita } from "@/modules/mejoramiento/ui/DetalleVisita";

export const metadata = { title: "Visita de mejoramiento" };

/** Another inspector's visit answers 404, exactly like one that does not exist (S7). */
export default async function DetalleVisitaPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionOLogin("inspector");
  const { id } = await params;
  const d = await detalleVisible(sesion, id);
  if (!d) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/mejoramiento" className="text-sm text-primary-strong underline">
        Volver a las visitas
      </Link>
      <h1 className="text-2xl font-bold text-primary-strong">Visita {d.visita.codigo}</h1>
      <DetalleVisita v={d.visita} id={id} urls={d.urls} />
    </div>
  );
}
