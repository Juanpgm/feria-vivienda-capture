"use client";

import { Controller, useFormContext, type FieldValues } from "react-hook-form";
import { CONDICIONES_ESPECIALES } from "@/shared/constantes";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { useError } from "@/modules/registro/ui/campos";

const OPCIONES = Object.entries(CONDICIONES_ESPECIALES).map(([value, label]) => ({ value, label }));

export function PasoProteccion() {
  const { control, setValue } = useFormContext<FieldValues>();
  const name = "composicion.condiciones_especiales";
  const error = useError()(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <MultiSelect
          label="Condiciones del solicitante o su hogar"
          hint="Seleccione todas las que apliquen. Si ninguna aplica, elija «Ninguna»."
          error={error}
          options={OPCIONES}
          value={field.value ?? []}
          onChange={(v) => setValue(name, v, { shouldValidate: true, shouldDirty: true })}
          onBlur={field.onBlur}
          exclusiva="ninguna"
        />
      )}
    />
  );
}
