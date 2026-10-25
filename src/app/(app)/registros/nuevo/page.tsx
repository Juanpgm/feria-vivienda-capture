import { sesionOLogin } from "@/modules/auth/server/guard";
import { Stepper } from "@/modules/registro/ui/Stepper";

export const metadata = { title: "Nuevo registro" };

export default async function NuevoRegistro() {
  const sesion = await sesionOLogin();
  return <Stepper uid={sesion.uid} />;
}
