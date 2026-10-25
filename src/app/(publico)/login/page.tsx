import Link from "next/link";
import { FormAuth } from "@/modules/auth/ui/FormAuth";

export const metadata = { title: "Ingresar | Feria de Vivienda" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-primary-strong">Ingresar</h1>
      <FormAuth modo="login" />
      <p className="text-sm">
        ¿Primera vez?{" "}
        <Link href="/registro" className="font-semibold text-primary-strong underline">
          Crear cuenta
        </Link>
      </p>
    </>
  );
}
