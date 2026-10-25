"use client";

import { useSyncExternalStore } from "react";

// Whether a pointer (mouse, finger, pen) is currently held down anywhere in the page.
// Used to hold back layout changes (blur errors) until the press that caused the blur has become a click.
let presionado = false;
const oyentes = new Set<() => void>();

function poner(v: boolean) {
  if (presionado === v) return;
  presionado = v;
  oyentes.forEach((o) => o());
}

// Released one task late so the click that follows pointerup is dispatched against the layout the user pressed on.
const soltar = () => setTimeout(() => poner(false), 0);
const apretar = () => poner(true);
// A click means the press completed on a target: whatever it triggers (e.g. a failed "Siguiente" focusing the first
// invalid field) must see the errors rendered, so release right away instead of one task later. Bubble phase on purpose:
// re-rendering before the target's handlers resets a controlled radio/checkbox React is about to report as changed.
const clic = () => poner(false);

function suscribir(avisar: () => void) {
  if (oyentes.size === 0) {
    document.addEventListener("pointerdown", apretar, true);
    document.addEventListener("pointerup", soltar, true);
    document.addEventListener("pointercancel", soltar, true);
    document.addEventListener("click", clic);
    window.addEventListener("blur", soltar);
  }
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
    if (oyentes.size === 0) {
      document.removeEventListener("pointerdown", apretar, true);
      document.removeEventListener("pointerup", soltar, true);
      document.removeEventListener("pointercancel", soltar, true);
      document.removeEventListener("click", clic);
      window.removeEventListener("blur", soltar);
      presionado = false;
    }
  };
}

export const usePunteroPresionado = () =>
  useSyncExternalStore(suscribir, () => presionado, () => false);
