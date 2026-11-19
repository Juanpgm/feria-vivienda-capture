"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * Header navigation: its own row under the brand on lg+, behind a "Menú" button on phones (the links used to take half the screen).
 * Closes on navigation and with Escape.
 */
export function MenuNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [ruta, setRuta] = useState(pathname);
  if (ruta !== pathname) {
    setRuta(pathname);
    setAbierto(false);
  }
  return (
    <>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="menu-principal"
        onClick={() => setAbierto((a) => !a)}
        className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold lg:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        {abierto ? "Cerrar" : "Menú"}
      </button>
      <div
        id="menu-principal"
        onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
        className={`${abierto ? "flex" : "hidden"} basis-full flex-col gap-2 border-t border-border pt-2 lg:flex lg:flex-row lg:items-center`}
      >
        {children}
      </div>
    </>
  );
}
