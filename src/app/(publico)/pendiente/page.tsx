import Link from "next/link";

export const metadata = { title: "Cuenta pendiente | Feria de Vivienda" };

export default function PendientePage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-primary-strong">Cuenta pendiente de aprobación</h1>
      <p>
        Un administrador revisará la cuenta. Cuando esté aprobada, use Ingresar para entrar. Esta página se puede cerrar.
      </p>
      <Link
        href="/login"
        className="inline-flex min-h-11 w-fit items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
      >
        Ingresar
      </Link>
    </>
  );
}
