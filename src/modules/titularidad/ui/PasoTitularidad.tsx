"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { EXCEPCIONES_UNICA_PROPIEDAD, TITULARIDADES } from "@/shared/constantes";
import { Field } from "@/shared/ui/Field";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Select } from "@/shared/ui/Select";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";

const P = "titularidad.";
const EXCEPCIONES = Object.entries(EXCEPCIONES_UNICA_PROPIEDAD).map(([value, label]) => ({ value, label }));

export function PasoTitularidad() {
  const { register, setValue, control } = useFormContext<FieldValues>();
  const error = useError();
  const unica = useWatch({ control, name: P + "es_unica_propiedad" });
  const excepcion = useWatch({ control, name: P + "excepcion_unica_propiedad" });
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h4 className="text-lg font-bold text-primary-strong">Relación con el inmueble</h4>
        <SegmentedControl
          legend="El solicitante es"
          name={P + "tipo_titularidad"}
          options={Object.entries(TITULARIDADES).map(([value, label]) => ({ value, label }))}
          error={error(P + "tipo_titularidad")}
          inputProps={register(P + "tipo_titularidad")}
        />
        <div className="max-w-sm">
          <CampoTexto
            name={P + "numero_matricula_inmobiliaria"}
            label="Número de matrícula (opcional)"
            autoComplete="off"
            hint="Puede dejarlo vacío si no lo tiene a la mano"
            normalizar={(v) => v.trim()}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h4 className="text-lg font-bold text-primary-strong">Única propiedad residencial</h4>
        <SegmentedControl
          legend="¿Es su única propiedad residencial?"
          name={P + "es_unica_propiedad"}
          options={[
            { value: "si", label: "Sí" },
            { value: "no", label: "No" },
          ]}
          error={error(P + "es_unica_propiedad")}
          inputProps={register(P + "es_unica_propiedad", {
            onChange: (e) => {
              if (e.target.value !== "si") return;
              setValue(P + "excepcion_unica_propiedad", "");
              setValue(P + "excepcion_otra", "");
            },
          })}
        />
        {unica === "no" && (
          <div className="max-w-xl">
            <Field label="Excepción que aplica" error={error(P + "excepcion_unica_propiedad")}>
              {(a11y) => <Select {...a11y} options={EXCEPCIONES} {...register(P + "excepcion_unica_propiedad")} />}
            </Field>
            {excepcion === "otra" && (
              <div className="mt-4">
                <CampoTexto name={P + "excepcion_otra"} label="Describa la excepción" autoComplete="off" />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
