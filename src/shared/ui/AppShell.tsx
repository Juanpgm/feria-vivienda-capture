import Image from "next/image";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

/** Page chrome: brand header + content. `nav` (optional) is rendered in the header (wired in later PRs). */
export function AppShell({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
        {/* Light plate keeps the provisional logo legible in dark mode; official negative lockup pending. */}
        <span className="rounded-md bg-white p-1">
          <Image src="/brand/logo-alcaldia.png" alt="Alcaldía de Santiago de Cali" width={401} height={313} priority style={{ width: "auto", height: "2.5rem" }} />
        </span>
        <span className="text-sm font-semibold text-primary-strong">Secretaría de Vivienda Social y Hábitat</span>
        <div className="ml-auto flex items-center gap-2">
          {nav}
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
