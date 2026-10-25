"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { derivarIngreso, formatoCop, RANGOS_SMLMV } from "@/modules/cierre-financiero/domain/smlmv";
import { parsearIngresoCop } from "@/shared/normalizacion/texto";
import { Field, TextInput } from "@/shared/ui/Field";
import { RadioGroup } from "@/shared/ui/Radio";
import { CampoTexto, Seccion, useError } from "@/modules/registro/ui/campos";

const P = "composicion.";
const MAX_ADULTOS = 20;

export function PasoComposicion() {
  const { register, control } = useFormContext<FieldValues>();
  const error = useError();
  const tiene = useWatch({ control, name: P + "tiene_adulto_mayor" });
  const cantidad = Number(useWatch({ control, name: P + "cantidad_adultos_mayores" }));
  const ingreso = parsearIngresoCop(String(useWatch({ control, name: P + "ingreso_hogar_cop" }) ?? ""));
  const n = Number.isInteger(cantidad) ? Math.min(Math.max(cantidad, 0), MAX_ADULTOS) : 0;
  const rango = ingreso === null ? null : RANGOS_SMLMV.find((r) => r.codigo === derivarIngreso(ingreso).rango_ingresos_smlmv);

  return (
    <div className="flex flex-col gap-8">
      <Seccion titulo="Hogar">
        <CampoTexto name={P + "cantidad_personas_hogar"} label="Personas que viven en el hogar" type="number" inputMode="numeric" min={1} />
      </Seccion>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Adultos mayores</h3>
        <RadioGroup
          legend="¿Hay adultos mayores en el hogar?"
          name={P + "tiene_adulto_mayor"}
          options={[
            { value: "si", label: "Sí" },
            { value: "no", label: "No" },
          ]}
          error={error(P + "tiene_adulto_mayor")}
          inputProps={register(P + "tiene_adulto_mayor")}
        />
        {tiene === "si" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto name={P + "cantidad_adultos_mayores"} label="Cuántos adultos mayores" type="number" inputMode="numeric" min={1} max={MAX_ADULTOS} />
            {Array.from({ length: n }, (_, i) => (
              <CampoTexto key={i} name={`${P}adultos_mayores.${i}.edad`} label={`Edad del adulto mayor ${i + 1}`} type="number" inputMode="numeric" min={60} max={120} />
            ))}
            {error(P + "adultos_mayores.root") && (
              <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">
                {error(P + "adultos_mayores.root")}
              </p>
            )}
          </div>
        )}
      </section>

      <Seccion titulo="Ingresos">
        <Field
          label="Ingreso mensual del hogar (COP)"
          hint={
            rango && ingreso !== null
              ? `${formatoCop(ingreso)}: ${rango.etiqueta}`
              : "Escriba el valor en pesos, por ejemplo 1.500.000"
          }
          error={error(P + "ingreso_hogar_cop")}
        >
          {(a11y) => <IngresoInput a11y={a11y} />}
        </Field>
      </Seccion>
    </div>
  );
}

/** Shows the amount with thousands separators after blur. */
function IngresoInput({ a11y }: { a11y: object }) {
  const { register, setValue } = useFormContext<FieldValues>();
  const r = register(P + "ingreso_hogar_cop");
  return (
    <TextInput
      {...a11y}
      {...r}
      inputMode="numeric"
      autoComplete="off"
      onBlur={async (e) => {
        const n = parsearIngresoCop(e.target.value);
        if (n !== null) setValue(P + "ingreso_hogar_cop", n.toLocaleString("es-CO"));
        await r.onBlur(e);
      }}
    />
  );
}
