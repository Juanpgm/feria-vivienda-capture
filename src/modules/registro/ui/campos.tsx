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
  /** Runs after blur normalization with the final text (e.g. to trigger a server-side check). */
  alSalir?: (valor: string) => void;
};

export function CampoTexto({ name, label, hint, normalizar, alSalir, ...input }: Props) {
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
            alSalir?.(n ?? valor);
          }}
        />
      )}
    </Field>
  );
}

/** Titled block of fields. `sub` renders an h4, for screens nested under a section heading (merged steps). */
export function Seccion({ titulo, sub, children }: { titulo: string; sub?: boolean; children: React.ReactNode }) {
  const H = sub ? "h4" : "h3";
  return (
    <section className="flex flex-col gap-4">
      <H className="text-lg font-bold text-primary-strong">{titulo}</H>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
