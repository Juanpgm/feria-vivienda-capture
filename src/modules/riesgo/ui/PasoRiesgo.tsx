"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { DICTAMENES } from "@/shared/constantes";
import { Field } from "@/shared/ui/Field";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Select } from "@/shared/ui/Select";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";

const P = "riesgo.";
const SI_NO = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];
const OPCIONES_DICTAMEN = Object.entries(DICTAMENES).map(([value, label]) => ({ value, label }));

export function PasoRiesgo() {
  const { register, setValue, control } = useFormContext<FieldValues>();
  const error = useError();
  const enRud = useWatch({ control, name: P + "esta_en_rud" });
  const noSabe = !!useWatch({ control, name: P + "rud_no_sabe" });
  const dictamen = useWatch({ control, name: P + "dictamen" });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h4 className="text-lg font-bold text-primary-strong">Registro Único de Damnificados (RUD)</h4>
        <SegmentedControl legend="¿Está registrado en el RUD?" name={P + "esta_en_rud"} options={SI_NO} error={error(P + "esta_en_rud")} inputProps={register(P + "esta_en_rud")} />
        {enRud === "si" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto name={P + "numero_rud"} label="Número de RUD" autoComplete="off" disabled={noSabe} />
            <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:mt-6 sm:self-start">
              <input
                type="checkbox"
                className="check"
                {...register(P + "rud_no_sabe", { onChange: (e) => e.target.checked && setValue(P + "numero_rud", "") })}
              />
              No lo sé
            </label>
          </div>
        )}
      </section>

      <section className="flex max-w-md flex-col gap-4">
        <h4 className="text-lg font-bold text-primary-strong">Dictamen técnico</h4>
        <Field label="Resultado del dictamen técnico" error={error(P + "dictamen")}>
          {(a11y) => <Select {...a11y} options={OPCIONES_DICTAMEN} {...register(P + "dictamen")} />}
        </Field>
        {dictamen === "otro" && <CampoTexto name={P + "dictamen_otro"} label="Cuál dictamen" autoComplete="off" />}
      </section>
    </div>
  );
}
