"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import type { OpcionBusqueda } from "@/shared/busqueda";
import { FUENTES_FINANCIACION } from "@/shared/constantes";
import { Combobox } from "@/shared/ui/Combobox";
import { Field } from "@/shared/ui/Field";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";

const P = "cierre_financiero.";
const FUENTES = Object.entries(FUENTES_FINANCIACION).map(([value, label]) => ({ value, label }));

export function PasoCierreFinanciero() {
  const { register, control, setValue } = useFormContext<FieldValues>();
  const error = useError();
  const [aseguradoras, setAseguradoras] = useState<OpcionBusqueda[]>([]);
  const seguro = useWatch({ control, name: P + "tiene_seguro" });
  const codigo = useWatch({ control, name: P + "codigo_aseguradora" });

  useEffect(() => {
    import("../catalogo/aseguradoras.json").then((m) => setAseguradoras(m.default.items.map((a) => ({ value: a.codigo, label: a.nombre }))));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <Controller
        control={control}
        name={P + "fuentes_financiacion"}
        render={({ field }) => (
          <MultiSelect
            label="Fuentes de financiación"
            hint="Seleccione todas las que apliquen. Si no cuenta con ninguna, elija «Ninguna»."
            error={error(P + "fuentes_financiacion")}
            options={FUENTES}
            value={field.value ?? []}
            onChange={(v) => setValue(P + "fuentes_financiacion", v, { shouldValidate: true, shouldDirty: true })}
            onBlur={field.onBlur}
            exclusiva="ninguna"
          />
        )}
      />

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Seguro</h3>
        <SegmentedControl
          legend="¿El inmueble tenía seguro?"
          name={P + "tiene_seguro"}
          options={[
            { value: "si", label: "Sí" },
            { value: "no", label: "No" },
          ]}
          error={error(P + "tiene_seguro")}
          inputProps={register(P + "tiene_seguro")}
        />
        {seguro === "si" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name={P + "codigo_aseguradora"}
              render={({ field }) => (
                <Field label="Aseguradora" hint="Escriba para buscar" error={error(P + "codigo_aseguradora")}>
                  {(a11y) => <Combobox {...a11y} options={aseguradoras} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />}
                </Field>
              )}
            />
            {codigo === "otra" && <CampoTexto name={P + "aseguradora_otra"} label="Nombre de la aseguradora" autoComplete="off" />}
          </div>
        )}
      </section>
    </div>
  );
}
