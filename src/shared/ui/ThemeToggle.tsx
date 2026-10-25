"use client";

import { useEffect, useSyncExternalStore } from "react";
import { guardarTema, leerTemaGuardado, resolverTemaOscuro } from "@/shared/tema";

const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
};

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  // Live OS changes apply only while the user has not made an explicit choice.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      document.documentElement.classList.toggle("dark", resolverTemaOscuro(leerTemaGuardado(), mq.matches));
    // Re-sync once mounted in case the inline script ran before the scheme settled.
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    guardarTema(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="min-h-11 min-w-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface"
    >
      {dark ? "Tema claro" : "Tema oscuro"}
    </button>
  );
}
