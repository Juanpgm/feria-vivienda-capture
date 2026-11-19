import Image from "next/image";
import type { ReactNode } from "react";
import { MenuNav } from "./MenuNav";
import { ThemeToggle } from "./ThemeToggle";

/** Page chrome: brand header + content. `nav` (optional) goes in the header, behind a menu button on phones. */
export function AppShell({ children, nav, usuario }: { children: ReactNode; nav?: ReactNode; usuario?: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-4 py-2 print:hidden">
        {/* Light plate keeps the provisional logo legible in dark mode; official negative lockup pending. */}
        <span className="shrink-0 rounded-md bg-white p-1">
          <Image src="/brand/logo-alcaldia.png" alt="Alcaldía de Santiago de Cali" width={401} height={313} priority style={{ width: "auto", height: "2.5rem" }} />
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-primary-strong">Secretaría de Vivienda Social y Hábitat</span>
        {usuario && <span className="hidden text-sm text-muted lg:inline">{usuario}</span>}
        {nav ? (
          <MenuNav>
            {nav}
            <div className="px-3 lg:px-0">
              <ThemeToggle />
            </div>
          </MenuNav>
        ) : (
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
