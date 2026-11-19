"use client";

// Staff edit: what is still missing for validation, live, with a link to each field (S11 "subsanar").
import { useWatch } from "react-hook-form";
import { armarDatos, type Valores } from "../domain/armar";

/** Step of the form that holds a field path ("solicitante.x" -> 0, "hogar.x" -> 1, "postulacion.x" -> 2). */
export const pasoDeCampo = (ruta: string) => (ruta.startsWith("hogar.") ? 1 : ruta.startsWith("postulacion.") ? 2 : 0);

/**
 * Moves the focus to the control of `ruta` once its step is on screen. Some controls appear a moment later (location
 * after the address search, lazy catalogs), so it retries for a few seconds.
 */
export function enfocarCampo(ruta: string) {
  let intentos = 0;
  const buscar = () => {
    const el = document.querySelector<HTMLElement>(`[name="${CSS.escape(ruta)}"]`);
    if (el && !el.hasAttribute("disabled")) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
      return;
    }
    if (++intentos < 30) setTimeout(buscar, 150);
  };
  setTimeout(buscar, 50);
}

export function PorCompletar({ alIr }: { alIr: (ruta: string) => void }) {
  const r = armarDatos((useWatch() ?? {}) as Valores);
  if (!r.ok) return null; // fields with errors are pointed out by the form itself
  if (!r.faltantes.length)
    return (
      <p role="status" className="mb-6 rounded-lg border border-success p-3 font-semibold text-success">
        Ya no falta ningún dato obligatorio. Guarde los cambios para poder validar la postulación.
      </p>
    );
  return (
    <section aria-labelledby="por-completar" className="mb-6 rounded-lg border-2 border-warning-text bg-warning-bg p-4 text-warning-text">
      <h2 id="por-completar" className="font-bold">Por completar: {r.faltantes.length} dato(s)</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {r.faltantes.map((f) => (
          <li key={f.ruta}>
            <button type="button" onClick={() => alIr(f.ruta)} className="min-h-9 rounded-full border border-warning-text/40 bg-bg px-3 text-sm font-semibold text-text hover:border-warning-text">
              {f.etiqueta}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
