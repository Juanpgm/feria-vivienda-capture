"use client";

import { useId, useState, type ReactNode } from "react";
import { ayudaDe } from "../ayudas";

/**
 * "?" button next to a label that opens a plain-language explanation right under it (no hover tooltip: it has to work
 * on a phone). Returns the two pieces so the caller can place the button beside the label and the text below it.
 * Nothing is rendered when the label has no help text.
 */
export function useAyuda(etiqueta: string, explicita?: string): { boton: ReactNode; panel: ReactNode } {
  const id = useId();
  const [abierta, setAbierta] = useState(false);
  const texto = explicita ?? ayudaDe(etiqueta);
  if (!texto) return { boton: null, panel: null };
  return {
    boton: (
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        aria-label={`Ayuda: ${etiqueta}`}
        onClick={() => setAbierta((a) => !a)}
        // Visually a 24px badge; the padding makes the touch target 44px.
        className="-my-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <span aria-hidden="true" className={`grid size-6 place-items-center rounded-full border-2 border-primary text-sm font-bold ${abierta ? "bg-primary text-on-primary" : "text-primary"}`}>
          ?
        </span>
      </button>
    ),
    panel: abierta ? (
      <p id={id} role="note" className="rounded-lg border border-border bg-surface p-3 text-sm">
        {texto}
      </p>
    ) : null,
  };
}
