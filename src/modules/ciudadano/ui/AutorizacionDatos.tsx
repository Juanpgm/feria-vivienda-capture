"use client";

import { useState } from "react";
import { ETIQUETA_SENSIBLES, ETIQUETA_TRATAMIENTO, POLITICA_URL, SECCIONES_TEXTO } from "@/modules/consentimiento/domain/texto";
import { Button } from "@/shared/ui/Button";

/**
 * Habeas Data authorization shown BEFORE the citizen starts the form. The same wording the form stores (versioned and
 * hashed by the server). The form's own authorization step arrives pre-filled with what is accepted here.
 */
export function AutorizacionDatos({ alAceptar }: { alAceptar: (aceptaSensibles: boolean) => void }) {
  const [tratamiento, setTratamiento] = useState(false);
  const [sensibles, setSensibles] = useState(false);
  const [intento, setIntento] = useState(false);

  return (
    <section aria-labelledby="aut-titulo" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 id="aut-titulo" className="text-2xl font-bold text-primary-strong">
          Autorización para el tratamiento de datos personales
        </h2>
        <p className="mt-1 text-muted">Antes de comenzar, lea y responda. Ley 1581 de 2012 (Habeas Data).</p>
      </div>

      {SECCIONES_TEXTO.map((s) => (
        <section key={s.id} className="flex flex-col gap-2">
          <h3 className="text-lg font-bold text-primary-strong">{s.titulo}</h3>
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
        La política completa está publicada en{" "}
        <a href={POLITICA_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
          la Política de tratamiento de datos personales (se abre en otra pestaña)
        </a>
        .
      </p>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
          <input type="checkbox" className="check mt-0.5" checked={tratamiento} onChange={(e) => setTratamiento(e.target.checked)} />
          <span className="font-semibold">{ETIQUETA_TRATAMIENTO}</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
          <input type="checkbox" className="check mt-0.5" checked={sensibles} onChange={(e) => setSensibles(e.target.checked)} />
          <span className="font-semibold">{ETIQUETA_SENSIBLES}</span>
        </label>
        {intento && (!tratamiento || !sensibles) && (
          <p role="alert" className="text-sm font-medium text-danger">
            Para continuar con el registro debe autorizar el tratamiento de sus datos personales y de sus datos sensibles.
          </p>
        )}
        <div>
          <Button
            onClick={() => {
              setIntento(true);
              if (tratamiento && sensibles) alAceptar(true);
            }}
          >
            Aceptar y comenzar
          </Button>
        </div>
      </div>
    </section>
  );
}
