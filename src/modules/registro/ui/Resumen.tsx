"use client";

import { useEffect, useState } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { fechaBogota } from "@/shared/tiempo";
import { ListaFilas } from "./ListaFilas";
import { anclaDe, PASOS, type Valores } from "./pasos";
import { evaluarRegistro, filasConsentimiento, filasDe, SECCIONES, type Evaluacion } from "./datosResumen";

/**
 * Read-only review of everything entered and the authorization status; the first block of the last step. The
 * pending requirements, the signature and the send action follow it (EnvioRegistro).
 */
export function Resumen({ irAPaso }: { irAPaso: (id: string, ancla?: string) => void }) {
  const { getValues } = useFormContext<FieldValues>();
  const [evaluacion, setEvaluacion] = useState<Record<string, Evaluacion<unknown>> | null>(null);

  useEffect(() => {
    evaluarRegistro(getValues() as Valores).then(setEvaluacion);
  }, [getValues]);

  if (!evaluacion) return <p role="status">Preparando el resumen…</p>;
  const hoy = fechaBogota();
  const incompletas = SECCIONES.filter((s) => !evaluacion[s.id].ok);

  return (
    <div className="flex flex-col gap-8">
      <p className={incompletas.length ? "font-medium text-danger" : "text-muted"}>
        {incompletas.length
          ? `Faltan datos en ${incompletas.length} ${incompletas.length === 1 ? "sección" : "secciones"}: ${incompletas.map((s) => s.titulo).join(", ")}.`
          : "Los datos de los pasos anteriores están completos. Revíselos antes de continuar."}
      </p>

      {SECCIONES.map((s) => {
        const ev = evaluacion[s.id];
        const indice = PASOS.findIndex((p) => p.id === s.paso) + 1;
        return (
          <section key={s.id} aria-labelledby={`resumen-${s.id}`}>
            <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-border pb-1">
              <h3 id={`resumen-${s.id}`} className="text-lg font-bold text-primary-strong">
                {s.titulo}
              </h3>
              <button
                type="button"
                onClick={() => irAPaso(s.paso, anclaDe(s.id))}
                aria-label={`Editar ${s.titulo} (paso ${indice})`}
                className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline underline-offset-2"
              >
                Editar
              </button>
            </div>
            {ev.ok ? (
              <ListaFilas filas={filasDe(s.id, ev.datos, hoy)} />
            ) : (
              <ul className="flex flex-col gap-1">
                {ev.errores.map((e) => (
                  <li key={e.campo} className="text-danger">
                    <span className="font-semibold">{e.campo}:</span> {e.mensaje}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section aria-labelledby="resumen-consentimiento">
        <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-border pb-1">
          <h3 id="resumen-consentimiento" className="text-lg font-bold text-primary-strong">
            Autorización de datos
          </h3>
          <button
            type="button"
            onClick={() => irAPaso("autorizacion", anclaDe("consentimiento"))}
            aria-label="Editar Autorización de datos"
            className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline underline-offset-2"
          >
            Editar
          </button>
        </div>
        <ListaFilas filas={filasConsentimiento((getValues("consentimiento") ?? {}) as Record<string, unknown>)} />
      </section>
    </div>
  );
}
