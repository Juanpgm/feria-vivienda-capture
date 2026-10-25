"use client";

// Field helpers bound to the form context. Values are normalized on blur so the user sees what is stored.
import { get, useFormContext, type FieldValues } from "react-hook-form";
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
