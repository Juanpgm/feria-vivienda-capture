"use client";

// Field helpers bound to the form context. Values are normalized on blur so the user sees what is stored.
import { get, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { Field, TextInput } from "@/shared/ui/Field";
import type { InputHTMLAttributes } from "react";

export function useError() {
  const { formState } = useFormContext<FieldValues>();
  return (name: string): string | undefined => (get(formState.errors, name) as { message?: string } | undefined)?.message;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "name"> & {
  name: string;
  label: string;
  hint?: string;
  /** Returns the normalized text, or null to leave what the user typed (so the error explains it). */
  normalizar?: (v: string) => string | null | Promise<string | null>;
};

export function CampoTexto({ name, label, hint, normalizar, ...input }: Props) {
  const { register, setValue } = useFormContext<FieldValues>();
  const error = useError()(name);
  const r = register(name);
  return (
    <Field label={label} hint={hint} error={error}>
      {(a11y) => (
        <TextInput
          {...a11y}
          {...input}
          {...r}
          onBlur={async (e) => {
            const valor = e.target.value;
            const n = await normalizar?.(valor);
            if (n != null && n !== valor) setValue(name, n, { shouldDirty: true });
            await r.onBlur(e);
          }}
        />
      )}
    </Field>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-bold text-primary-strong">{titulo}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Checkbox group stored as a code array in the form; "ninguna" excludes every other choice in both directions. */
export function CasillasExclusivas({
  name,
  legend,
  ayuda,
  opciones,
  claseLegend = "mb-1 text-lg font-bold text-primary-strong",
}: {
  name: string;
  legend: string;
  ayuda: string;
  opciones: Record<string, string>;
  claseLegend?: string;
}) {
  const { setValue, control } = useFormContext<FieldValues>();
  const error = useError()(name);
  const elegidas: string[] = useWatch({ control, name }) ?? [];

  function alternar(codigo: string, marcada: boolean) {
    const nuevas =
      codigo === "ninguna"
        ? marcada ? ["ninguna"] : []
        : [...elegidas.filter((c) => c !== "ninguna" && c !== codigo), ...(marcada ? [codigo] : [])];
    setValue(name, nuevas, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined} className="flex flex-col gap-3">
      <legend className={claseLegend}>{legend}</legend>
      <p className="text-sm text-muted">{ayuda}</p>
      {Object.entries(opciones).map(([codigo, etiqueta]) => (
        <label
          key={codigo}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 has-checked:border-primary has-checked:bg-surface"
        >
          <input type="checkbox" className="check" checked={elegidas.includes(codigo)} onChange={(e) => alternar(codigo, e.target.checked)} />
          {etiqueta}
        </label>
      ))}
      {error && (
        <p id={`${name}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
