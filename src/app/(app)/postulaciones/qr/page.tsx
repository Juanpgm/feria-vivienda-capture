import { sesionOLogin } from "@/modules/auth/server/guard";
import { CartelQr } from "@/modules/postulacion/ui/CartelQr";

export const metadata = { title: "Código QR de postulación" };

export default async function QrPostulacion() {
  await sesionOLogin();
  return <CartelQr />;
}
