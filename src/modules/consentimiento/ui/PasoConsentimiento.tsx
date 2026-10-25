"use client";

import { useId } from "react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { useError } from "@/modules/registro/ui/campos";
import { CONDICIONES_ESPECIALES } from "@/shared/constantes";
import {
  CONSENTIMIENTO_VERSION, ESTADO_TEXTO, ETIQUETA_SENSIBLES, ETIQUETA_TRATAMIENTO, POLITICA_URL, SECCIONES_TEXTO,
} from "../domain/texto";

const P = "consentimiento.";

/** Habeas Data authorization (Ley 1581 de 2012, Decreto 1377 de 2013). The wording lives in domain/texto.ts. */
export function PasoConsentimiento() {
  const { register, setValue, control } = useFormContext<FieldValues>();
  const error = useError();
  const idTexto = useId();
  const sensibles = useWatch({ control, name: P + "acepta_datos_sensibles" });
  const condiciones = (useWatch({ control, name: "composicion.condiciones_especiales" }) ?? []) as string[];
  const marcadas = condiciones.filter((c) => c !== "ninguna" && c in CONDICIONES_ESPECIALES);
  const errorTratamiento = error(P + "acepta_tratamiento");

  return (
    <div className="flex flex-col gap-8">
      <p className="rounded-lg bg-warning-bg p-3 text-sm font-medium text-warning-text">
        {ESTADO_TEXTO} Versión del texto: {CONSENTIMIENTO_VERSION}.
      </p>

      <div id={idTexto} className="flex flex-col gap-6">
        {SECCIONES_TEXTO.map((s) => (
          <section key={s.id} aria-labelledby={`${idTexto}-${s.id}`} className="flex flex-col gap-2">
            <h3 id={`${idTexto}-${s.id}`} className="text-lg font-bold text-primary-strong">
              {s.titulo}
            </h3>
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
        <h3 id={`${idTexto}-decision`} className="border-b border-border pb-1 text-lg font-bold text-primary-strong">
          Autorización del titular
        </h3>

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
            <input type="checkbox" className="check mt-0.5" aria-describedby={`${idTexto}-sens`} {...register(P + "acepta_datos_sensibles")} />
            <span className="font-semibold">{ETIQUETA_SENSIBLES}</span>
          </label>
          <p id={`${idTexto}-sens`} className="text-sm text-muted">
            {sensibles
              ? "Se guardará la información de especial protección que se registró."
              : "Si no se autoriza, el registro se envía igual, pero la información de especial protección no se guarda: queda como «no autorizado»."}
          </p>
          {!sensibles && marcadas.length > 0 && (
            <p role="status" className="text-sm font-medium">
              No se guardará lo marcado en Especial protección: {marcadas.map((c) => CONDICIONES_ESPECIALES[c as keyof typeof CONDICIONES_ESPECIALES]).join("; ")}.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
