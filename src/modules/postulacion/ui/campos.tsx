"use client";

// Small form-bound fields of the postulación, built on the shared Field/Select/SegmentedControl.
import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { formatoCop } from "@/modules/cierre-financiero/domain/smlmv";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";
import { parsearIngresoCop } from "@/shared/normalizacion/texto";
import { Field } from "@/shared/ui/Field";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Select, type Option } from "@/shared/ui/Select";

export const SI_NO: Option[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

/** Money: shown and stored as plain digits (S5); the hint reads it back formatted so the person can check it. */
export function CampoMoneda({ name, label, hint }: { name: string; label: string; hint?: string }) {
  const valor = useWatch({ name }) as string | undefined;
  const n = valor ? parsearIngresoCop(String(valor)) : null;
  return (
    <CampoTexto
      name={name}
      label={label}
      inputMode="numeric"
      autoComplete="off"
      placeholder="Ejemplo: 1500000"
      hint={n !== null ? `Valor: ${formatoCop(n)}` : (hint ?? "Solo números, sin puntos ni signo $")}
      normalizar={(v) => {
        const p = parsearIngresoCop(v);
        return p === null ? null : String(p);
      }}
    />
  );
}

export function CampoSelect({ name, label, options, hint }: { name: string; label: string; options: Option[]; hint?: string }) {
  const { register } = useFormContext<FieldValues>();
  const error = useError()(name);
  return (
    <Field label={label} hint={hint} error={error}>
      {(a11y) => <Select {...a11y} options={options} {...register(name)} />}
    </Field>
  );
}

export function CampoSiNo({ name, legend, options = SI_NO }: { name: string; legend: string; options?: Option[] }) {
  const { register } = useFormContext<FieldValues>();
  const error = useError()(name);
  return <SegmentedControl legend={legend} name={name} options={options} error={error} inputProps={register(name)} />;
}

export function CampoMultiple({ name, label, options, exclusiva, hint }: { name: string; label: string; options: Option[]; exclusiva?: string; hint?: string }) {
  const { control } = useFormContext<FieldValues>();
  const error = useError()(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <MultiSelect label={label} hint={hint} error={error} options={options} value={(field.value as string[]) ?? []} onChange={field.onChange} onBlur={field.onBlur} exclusiva={exclusiva} />
      )}
    />
  );
}
