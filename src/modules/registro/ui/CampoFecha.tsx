"use client";

import { useRef } from "react";
import { Controller, useFormContext, type FieldValues } from "react-hook-form";
import { aMascara, isoAMascara, parseMascara } from "@/shared/fecha";
import { Field, controlClass } from "@/shared/ui/Field";
import { esFechaIso } from "@/shared/validacion";
import { useError } from "./campos";

/**
 * Date typed as DD/MM/AAAA (digits only, slashes added as you go). The form holds ISO 8601 when the text is a real
 * date and the half-typed text otherwise, so the draft restores exactly what was on screen.
 * The calendar button opens the native picker of the browser through a visually hidden date input.
 */
export function CampoFecha({
  name, label, hint, max, mensajeMax,
}: { name: string; label: string; hint?: string; max?: string; mensajeMax?: string }) {
  const { control } = useFormContext<FieldValues>();
  const errorForm = useError()(name);
  const nativo = useRef<HTMLInputElement>(null);

  function abrirCalendario() {
    const el = nativo.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus(); // no showPicker: the focused date input still works with the keyboard
    }
  }

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const valor = String(field.value ?? "");
        const valida = esFechaIso(valor);
        const texto = isoAMascara(valor);
        const analisis = !valida && texto ? parseMascara(texto) : null;
        const mensaje = analisis && "mensaje" in analisis ? analisis.mensaje : undefined;
        // Impossible and too-late dates are explained while typing; "incomplete" and "empty" only once the field was validated.
        const error =
          analisis && "error" in analisis && analisis.error === "inexistente"
            ? mensaje
            : valida && max && mensajeMax && valor > max
              ? mensajeMax
              : errorForm && !valida
              ? (mensaje ?? "Ingrese la fecha (DD/MM/AAAA)")
              : errorForm;
        return (
          <Field label={label} hint={hint ?? "Día, mes y año. Ejemplo: 15/03/1985"} error={error}>
            {(a11y) => (
              <div className="relative flex gap-2">
                <input
                  {...a11y}
                  ref={field.ref}
                  name={field.name}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="DD/MM/AAAA"
                  className={controlClass}
                  value={texto}
                  onChange={(e) => {
                    const mascara = aMascara(e.target.value);
                    const r = parseMascara(mascara);
                    field.onChange("iso" in r ? r.iso : mascara);
                  }}
                  onBlur={field.onBlur}
                />
                <button
                  type="button"
                  onClick={abrirCalendario}
                  aria-label={`Abrir calendario de ${label.toLowerCase()}`}
                  className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-bg text-primary-strong hover:bg-surface"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                </button>
                <input
                  ref={nativo}
                  type="date"
                  tabIndex={-1}
                  aria-label={`Selector nativo de ${label.toLowerCase()}`}
                  min="1900-01-01"
                  max={max}
                  value={valida ? valor : ""}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    field.onChange(e.target.value);
                    field.onBlur();
                  }}
                  className="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
                />
              </div>
            )}
          </Field>
        );
      }}
    />
  );
}
