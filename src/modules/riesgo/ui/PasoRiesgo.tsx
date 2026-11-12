"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { DICTAMENES } from "@/shared/constantes";
import { RadioGroup } from "@/shared/ui/Radio";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";

const P = "riesgo.";
const SI_NO = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];
const DESCRIPCION_DICTAMEN: Record<string, string> = {
  colapso_total: "El inmueble se destruyó por completo.",
  demolido: "El inmueble ya fue demolido.",
  orden_demolicion: "Le informaron que el inmueble debe demolerse.",
  demolicion_en_proceso: "La demolición ya empezó.",
  arreglos_locativos: "Necesita reparaciones, pero no demolición.",
  otro: "Ninguna de las anteriores.",
};
const OPCIONES_DICTAMEN = Object.entries(DICTAMENES).map(([value, label]) => ({ value, label, description: DESCRIPCION_DICTAMEN[value] }));

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

      <section className="flex max-w-xl flex-col gap-4">
        <h4 className="text-lg font-bold text-primary-strong">Estado de la vivienda (dictamen técnico)</h4>
        <RadioGroup lista legend="Resultado del dictamen técnico" name={P + "dictamen"} options={OPCIONES_DICTAMEN} error={error(P + "dictamen")} inputProps={register(P + "dictamen")} />
        {dictamen === "otro" && <CampoTexto name={P + "dictamen_otro"} label="Cuál dictamen" autoComplete="off" />}
      </section>
    </div>
  );
}
