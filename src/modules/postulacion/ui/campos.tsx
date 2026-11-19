"use client";

// Small form-bound fields of the postulación, built on the shared Field/Select/SegmentedControl.
import { useEffect, useMemo, useState } from "react";
import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { Combobox } from "@/shared/ui/Combobox";
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

type Municipio = { codigo: string; nombre: string; departamento: string };
const CALI = "76001";
let municipios: Promise<Municipio[]> | null = null;
/** The 1,122 municipios (DIVIPOLA) load once, on first use, outside the main bundle. */
function useMunicipios() {
  const [lista, setLista] = useState<Municipio[]>([]);
  useEffect(() => {
    (municipios ??= import("@/shared/catalogo/municipios.json").then((m) => m.default)).then(setLista);
  }, []);
  return lista;
}

/** Searchable municipio of Colombia; stores the DIVIPOLA code. `exterior` adds "Fuera de Colombia" (value "exterior"). */
export function CampoMunicipio({ name, label, exterior = false }: { name: string; label: string; exterior?: boolean }) {
  const { control } = useFormContext<FieldValues>();
  const error = useError()(name);
  const lista = useMunicipios();
  const opciones = useMemo(
    () => [
      ...(exterior ? [{ value: "exterior", label: "Fuera de Colombia", keywords: "exterior extranjero otro pais" }] : []),
      // Cali first and labelled as people say it, so "cali" does not land on California (Santander).
      ...lista
        .map((m) => (m.codigo === CALI ? { value: m.codigo, label: "Cali (Valle del Cauca)", keywords: m.nombre } : { value: m.codigo, label: `${m.nombre} (${m.departamento})`, keywords: `${m.nombre} ${m.departamento}` }))
        .sort((a, b) => Number(b.value === CALI) - Number(a.value === CALI)),
    ],
    [lista, exterior],
  );
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} hint="Escriba el municipio y elíjalo de la lista" error={error}>
          {(a11y) => <Combobox {...a11y} options={opciones} value={field.value ?? ""} onChange={field.onChange} alDescartarTexto={field.onBlur} />}
        </Field>
      )}
    />
  );
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
