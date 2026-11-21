"use client";

// Controlled fields of the visit form (plain state, no react-hook-form): shared Field/TextInput/Select styling.
import type { InputHTMLAttributes } from "react";
import { Field, TextInput } from "@/shared/ui/Field";
import { Select } from "@/shared/ui/Select";

export const opciones = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

type Texto = { label: string; value?: string; onChange: (v: string) => void; error?: string; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;
export function CampoTexto({ label, value, onChange, error, hint, ...resto }: Texto) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(a11y) => <TextInput {...a11y} {...resto} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

export function CampoSelect({ label, value, onChange, error, catalogo }: { label: string; value?: string; onChange: (v: string | undefined) => void; error?: string; catalogo: Record<string, string> }) {
  return (
    <Field label={label} error={error}>
      {(a11y) => <Select {...a11y} options={opciones(catalogo)} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} />}
    </Field>
  );
}

/** Compact controlled segmented radios; tapping the selected option again clears it (every diagnostic answer is optional). */
export function Segmentos({ legend, name, value, onChange, catalogo, error, limpiable }: { legend: string; name: string; value?: string; onChange: (v: string | undefined) => void; catalogo: Record<string, string>; error?: string; limpiable?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      <div className={`flex flex-wrap gap-1 self-start rounded-lg border bg-surface p-1 ${error ? "border-danger" : "border-border"}`}>
        {opciones(catalogo).map((o) => (
          <label key={o.value} className="relative flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-md px-3 text-base text-text has-checked:bg-primary has-checked:font-semibold has-checked:text-on-primary">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              onClick={() => limpiable && value === o.value && onChange(undefined)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
