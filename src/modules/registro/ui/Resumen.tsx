"use client";

import { useEffect, useState } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { fechaBogota } from "@/shared/tiempo";
import { ListaFilas } from "./ListaFilas";
import { ListaRequisitos } from "./ListaRequisitos";
import { PASOS, type Valores } from "./pasos";
import { evaluarRegistro, filasConsentimiento, filasDe, SECCIONES, type Evaluacion } from "./datosResumen";
import { calcularRequisitos, type Requisitos } from "./requisitos";

/**
 * Read-only review of everything entered, the authorization status and what is still pending. The signature
 * (never shown here) and the send action live in the last step, "Firma y envío".
 */
export function Resumen({ irAPaso }: { irAPaso: (id: string) => void }) {
  const { getValues } = useFormContext<FieldValues>();
  const [evaluacion, setEvaluacion] = useState<Record<string, Evaluacion<unknown>> | null>(null);

  const [req, setReq] = useState<Requisitos | null>(null);

  useEffect(() => {
    evaluarRegistro(getValues() as Valores).then(setEvaluacion);
    calcularRequisitos(getValues() as Valores).then(setReq);
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
            onClick={() => irAPaso("consentimiento")}
            aria-label="Editar Autorización de datos"
            className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline underline-offset-2"
          >
            Editar
          </button>
        </div>
        <ListaFilas filas={filasConsentimiento((getValues("consentimiento") ?? {}) as Record<string, unknown>)} />
      </section>

      <section aria-labelledby="resumen-pendientes">
        <h3 id="resumen-pendientes" className="mb-2 border-b border-border pb-1 text-lg font-bold text-primary-strong">
          Pendiente para poder enviar
        </h3>
        {!req ? (
          <p role="status">Revisando requisitos…</p>
        ) : (
          <ListaRequisitos items={req.items} irAPaso={irAPaso} />
        )}
        <p className="mt-3 text-sm text-muted">La firma del solicitante y el envío se hacen en el último paso, «Firma y envío».</p>
      </section>
    </div>
  );
}
