"use client";

import { useSyncExternalStore } from "react";

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

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tema", next ? "oscuro" : "claro");
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
