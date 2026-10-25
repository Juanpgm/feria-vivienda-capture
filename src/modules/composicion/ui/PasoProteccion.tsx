"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { CONDICIONES_ESPECIALES } from "@/shared/constantes";
import { useError } from "@/modules/registro/ui/campos";

const NOMBRE = "composicion.condiciones_especiales";

export function PasoProteccion() {
  const { setValue, control } = useFormContext<FieldValues>();
  const error = useError()(NOMBRE);
  const elegidas: string[] = useWatch({ control, name: NOMBRE }) ?? [];

  function alternar(codigo: string, marcada: boolean) {
    // "Ninguna" excludes everything else, in both directions.
    const nuevas = codigo === "ninguna" ? (marcada ? ["ninguna"] : []) : [...elegidas.filter((c) => c !== "ninguna" && c !== codigo), ...(marcada ? [codigo] : [])];
    setValue(NOMBRE, nuevas, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <fieldset aria-describedby={error ? `${NOMBRE}-error` : undefined} className="flex flex-col gap-3">
      <legend className="mb-1 text-lg font-bold text-primary-strong">Condiciones del solicitante o su hogar</legend>
      <p className="text-sm text-muted">Marque todas las que apliquen. Si ninguna aplica, marque «Ninguna».</p>
      {Object.entries(CONDICIONES_ESPECIALES).map(([codigo, etiqueta]) => (
        <label
          key={codigo}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 has-checked:border-primary has-checked:bg-surface"
        >
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-primary"
            checked={elegidas.includes(codigo)}
            onChange={(e) => alternar(codigo, e.target.checked)}
          />
          {etiqueta}
        </label>
      ))}
      {error && (
        <p id={`${NOMBRE}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
