import Link from "next/link";
import { notFound } from "next/navigation";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { obtenerPostulacion } from "@/modules/postulacion/server/postulaciones.repo";
import { DetallePostulacion } from "@/modules/postulacion/ui/DetallePostulacion";

export const metadata = { title: "Postulación" };

export default async function VerPostulacion({ params }: { params: Promise<{ id: string }> }) {
  await sesionOLogin();
  const { id } = await params;
  const p = /^[0-9a-f-]{36}$/i.test(id) ? await obtenerPostulacion(id) : null;
  if (!p) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/postulaciones" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-2">
        ← Volver a postulaciones
      </Link>
      <DetallePostulacion p={p} />
    </div>
  );
}
