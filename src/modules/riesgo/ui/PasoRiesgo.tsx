"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { DICTAMENES } from "@/shared/constantes";
import { RadioGroup } from "@/shared/ui/Radio";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";

const P = "riesgo.";
const SI_NO = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

export function PasoRiesgo() {
  const { register, setValue, control } = useFormContext<FieldValues>();
  const error = useError();
  const enRud = useWatch({ control, name: P + "esta_en_rud" });
  const noSabe = !!useWatch({ control, name: P + "rud_no_sabe" });
  const dictamen = useWatch({ control, name: P + "dictamen" });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Registro Único de Damnificados (RUD)</h3>
        <RadioGroup legend="¿Está registrado en el RUD?" name={P + "esta_en_rud"} options={SI_NO} error={error(P + "esta_en_rud")} inputProps={register(P + "esta_en_rud")} />
        {enRud === "si" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto name={P + "numero_rud"} label="Número de RUD" autoComplete="off" disabled={noSabe} />
            <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:mt-6 sm:self-start">
              <input
                type="checkbox"
                className="check"
                {...register(P + "rud_no_sabe", { onChange: (e) => e.target.checked && setValue(P + "numero_rud", "") })}
              />
              No lo sabe
            </label>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Dictamen técnico</h3>
        <RadioGroup
          legend="Resultado del dictamen técnico"
          name={P + "dictamen"}
          options={Object.entries(DICTAMENES).map(([value, label]) => ({ value, label }))}
          error={error(P + "dictamen")}
          inputProps={register(P + "dictamen")}
        />
        {dictamen === "otro" && (
          <div className="max-w-sm">
            <CampoTexto name={P + "dictamen_otro"} label="Cuál dictamen" autoComplete="off" />
          </div>
        )}
      </section>
    </div>
  );
}
