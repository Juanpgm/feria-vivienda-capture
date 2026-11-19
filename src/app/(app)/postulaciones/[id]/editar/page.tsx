import { notFound, redirect } from "next/navigation";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { aValores } from "@/modules/postulacion/domain/formulario";
import { obtenerPostulacion } from "@/modules/postulacion/server/postulaciones.repo";
import { FormularioPostulacion } from "@/modules/postulacion/ui/FormularioPostulacion";

export const metadata = { title: "Editar postulación" };

/** S11: staff edit while not validated. Consent, declaration and signature are kept from the creation. */
export default async function EditarPostulacion({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionOLogin();
  const { id } = await params;
  const p = /^[0-9a-f-]{36}$/i.test(id) ? await obtenerPostulacion(id) : null;
  if (!p) notFound();
  if (p.estado === "valido") redirect(`/postulaciones/${id}`);
  // Plain JSON: the client form gets no Firestore types.
  const valores = JSON.parse(JSON.stringify(aValores(p)));
  return <FormularioPostulacion uid={sesion.uid} documento={p.solicitante.numero_documento} publico={false} edicion={{ id, radicado: p.radicado, valores }} />;
}
