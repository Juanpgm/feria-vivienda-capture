import Link from "next/link";
import { FormAuth } from "@/modules/auth/ui/FormAuth";

export const metadata = { title: "Crear cuenta | Feria de Vivienda" };

export default function RegistroPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-primary-strong">Crear cuenta</h1>
        <p className="mt-1 text-sm text-muted">Cualquier correo es válido. Un administrador debe aprobar la cuenta antes de ingresar datos.</p>
      </div>
      <FormAuth modo="registro" />
      <p className="text-sm">
        ¿Ya tiene cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary-strong underline">
          Ingresar
        </Link>
      </p>
    </>
  );
}
