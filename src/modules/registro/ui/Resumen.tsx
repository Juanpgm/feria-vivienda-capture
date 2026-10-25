"use client";

import { useEffect, useState } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { fechaBogota } from "@/shared/tiempo";
import { PASOS, type Valores } from "./pasos";
import { evaluarRegistro, filasDe, PENDIENTES_FASE_3, SECCIONES, type Evaluacion } from "./datosResumen";

/**
 * Read-only review of everything entered. Phase 3 extension point: add its sections (documents, consent,
 * signature) next to SECCIONES and remove the matching line from PENDIENTES_FASE_3; the submit action
 * goes after the pending-requirements section, enabled only when `incompletas` and the pending list are empty.
 */
export function Resumen({ irAPaso }: { irAPaso: (id: string) => void }) {
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
                onClick={() => irAPaso(s.paso)}
                aria-label={`Editar ${s.titulo} (paso ${indice})`}
                className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline underline-offset-2"
              >
                Editar
              </button>
            </div>
            {ev.ok ? (
              <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)]">
                {filasDe(s.id, ev.datos, hoy).map((f) => (
                  <div key={f.etiqueta} className="contents">
                    <dt className="text-sm text-muted sm:py-1">{f.etiqueta}</dt>
                    <dd className="mb-2 sm:mb-0 sm:py-1">{f.valor}</dd>
                  </div>
                ))}
              </dl>
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

      <section aria-labelledby="resumen-pendientes">
        <h3 id="resumen-pendientes" className="mb-2 border-b border-border pb-1 text-lg font-bold text-primary-strong">
          Pendiente para poder enviar
        </h3>
        <p className="mb-2 text-sm text-muted">
          Estos requisitos se agregan en el siguiente avance de la aplicación. Por ahora el registro no se puede enviar.
        </p>
        <ul className="list-disc pl-5">
          {PENDIENTES_FASE_3.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
