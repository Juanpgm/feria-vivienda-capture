import { sesionOLogin } from "@/modules/auth/server/guard";
import { EntradaRegistro } from "@/modules/registro/ui/EntradaRegistro";

export const metadata = { title: "Nuevo registro" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NuevoRegistro({ searchParams }: { searchParams: Promise<{ borrador?: string | string[] }> }) {
  const sesion = await sesionOLogin();
  const { borrador } = await searchParams;
  const id = typeof borrador === "string" && UUID.test(borrador) ? borrador.toLowerCase() : undefined;
  return <EntradaRegistro uid={sesion.uid} borradorId={id} />;
}
