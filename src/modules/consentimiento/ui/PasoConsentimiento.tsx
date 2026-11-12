"use client";

import { useId } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { useError } from "@/modules/registro/ui/campos";
import {
  CONSENTIMIENTO_VERSION, ETIQUETA_SENSIBLES, ETIQUETA_TRATAMIENTO, POLITICA_URL, SECCIONES_TEXTO,
} from "../domain/texto";

const P = "consentimiento.";

/** Habeas Data authorization (Ley 1581 de 2012, Decreto 1377 de 2013). The wording lives in domain/texto.ts. */
export function PasoConsentimiento() {
  const { register, setValue } = useFormContext<FieldValues>();
  const error = useError();
  const idTexto = useId();
  const errorTratamiento = error(P + "acepta_tratamiento");
  const errorSensibles = error(P + "acepta_datos_sensibles");

  return (
    <div className="flex flex-col gap-8">
      <div id={idTexto} className="flex flex-col gap-6">
        {SECCIONES_TEXTO.map((s) => (
          <section key={s.id} aria-labelledby={`${idTexto}-${s.id}`} className="flex flex-col gap-2">
            <h4 id={`${idTexto}-${s.id}`} className="text-lg font-bold text-primary-strong">
              {s.titulo}
            </h4>
            {s.parrafos.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.lista && (
              <ul className="list-disc pl-5">
                {s.lista.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <p>
          La política completa de la Alcaldía está publicada en{" "}
          <a href={POLITICA_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
            la Política de tratamiento de datos personales (se abre en otra pestaña)
          </a>
          .
        </p>
      </div>

      <section aria-labelledby={`${idTexto}-decision`} className="flex flex-col gap-4">
        <h4 id={`${idTexto}-decision`} className="border-b border-border pb-1 text-lg font-bold text-primary-strong">
          Autorización del titular
        </h4>

        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
            <input
              type="checkbox"
              className="check mt-0.5"
              aria-describedby={errorTratamiento ? `${idTexto}-error` : undefined}
              aria-invalid={errorTratamiento ? true : undefined}
              {...register(P + "acepta_tratamiento", { onChange: () => setValue(P + "version", CONSENTIMIENTO_VERSION) })}
            />
            <span className="font-semibold">{ETIQUETA_TRATAMIENTO}</span>
          </label>
          {errorTratamiento && (
            <p id={`${idTexto}-error`} role="alert" className="text-sm font-medium text-danger">
              {errorTratamiento}
            </p>
          )}
          <p className="text-sm text-muted">Es obligatoria para registrar la postulación. El texto de arriba es lo que la persona autoriza.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
            <input
              type="checkbox"
              className="check mt-0.5"
              aria-describedby={errorSensibles ? `${idTexto}-sens-error` : `${idTexto}-sens`}
              aria-invalid={errorSensibles ? true : undefined}
              {...register(P + "acepta_datos_sensibles")}
            />
            <span className="font-semibold">{ETIQUETA_SENSIBLES}</span>
          </label>
          {errorSensibles && (
            <p id={`${idTexto}-sens-error`} role="alert" className="text-sm font-medium text-danger">
              {errorSensibles}
            </p>
          )}
          <p id={`${idTexto}-sens`} className="text-sm text-muted">También es obligatoria para registrar la postulación.</p>
        </div>
      </section>
    </div>
  );
}
