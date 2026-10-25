"use client";

import { useEffect, useState } from "react";
import { leerRespuestaDuplicado, mensajeDuplicado } from "./duplicado";

type Hallazgo = { numero: string; texto: string };

/**
 * Non-blocking warning: after the funcionario leaves the document number, asks the server whether a registro with
 * that number already exists. Debounced and abortable; ANY failure (network, 4xx/5xx, bad JSON) is silently ignored,
 * because a failed check must never get in the way of data entry. `actual` hides a stale warning while editing.
 */
export function AvisoDuplicado({ consulta, actual }: { consulta: { tipo?: string; numero: string } | null; actual: string }) {
  const [hallazgo, setHallazgo] = useState<Hallazgo | null>(null);

  useEffect(() => {
    if (!consulta) return;
    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ numero: consulta.numero, ...(consulta.tipo ? { tipo: consulta.tipo } : {}) });
        const res = await fetch(`/api/registros/duplicado?${q}`, { signal: ac.signal });
        if (!res.ok) return setHallazgo(null);
        const r = leerRespuestaDuplicado(await res.json());
        setHallazgo(r ? { numero: consulta.numero, texto: mensajeDuplicado(r) } : null);
      } catch {
        // Advisory only.
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [consulta]);

  const visible = hallazgo && hallazgo.numero === actual ? hallazgo.texto : null;
  return (
    <div aria-live="polite" className="empty:hidden sm:col-span-2">
      {visible && (
        <p className="rounded-lg border border-warning-text bg-warning-bg p-3 text-sm font-medium text-warning-text">
          {visible}
        </p>
      )}
    </div>
  );
}
