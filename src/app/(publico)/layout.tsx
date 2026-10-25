import Image from "next/image";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";

// Two-column on desktop (brand panel + form); the panel collapses to a header on mobile.
export default function PublicoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[2fr_3fr]">
      <aside className="flex flex-col justify-between gap-8 bg-[#00365f] p-6 text-white md:p-12">
        <span className="w-fit rounded-md bg-white p-1">
          <Image src="/brand/logo-alcaldia.png" alt="Alcaldía de Santiago de Cali" width={112} height={40} priority className="h-10 w-auto" />
        </span>
        <div className="max-w-md">
          <span aria-hidden className="mb-4 block h-1 w-12 bg-accent" />
          <p className="text-xl font-semibold leading-snug md:text-3xl">
            Registro de postulantes a bonos de vivienda de emergencia.
          </p>
          <p className="mt-2 text-sm text-white/80">Herramienta de uso interno para funcionarios de la Alcaldía.</p>
        </div>
      </aside>
      <main className="flex flex-col p-6 md:p-12">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-8">{children}</div>
      </main>
    </div>
  );
}
