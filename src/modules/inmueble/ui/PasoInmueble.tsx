"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import type { OpcionBusqueda } from "@/shared/busqueda";
import { normalizarDireccion } from "@/shared/normalizacion/direccion";
import { Combobox } from "@/shared/ui/Combobox";
import { Field, TextInput } from "@/shared/ui/Field";
import { RadioGroup } from "@/shared/ui/Radio";
import { CampoTexto, Seccion, useError } from "@/modules/registro/ui/campos";
import divisiones from "../catalogo/divisiones.json";

const P = "inmueble.";
type Lugar = { id: string; nombre: string; codigo_division: string };

const OPCIONES_DIVISION: OpcionBusqueda[] = divisiones.map((d) => ({
  value: d.codigo,
  label: d.tipo === "comuna" ? d.nombre : `Corregimiento ${d.nombre}`,
  keywords: d.nombre,
}));
const ESTRATOS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }));

export function PasoInmueble() {
  const { register, setValue, getValues, control } = useFormContext<FieldValues>();
  const error = useError();
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const division = (useWatch({ control, name: P + "codigo_division" }) as string | undefined) ?? "";
  const noListado = !!useWatch({ control, name: P + "barrio_no_listado" });
  const direccion = (useWatch({ control, name: P + "direccion" }) as string | undefined) ?? "";

  useEffect(() => {
    import("../catalogo/barrios.json").then((m) => setLugares(m.default));
  }, []);

  const sel = divisiones.find((d) => d.codigo === division);
  const barrios = useMemo(
    () => lugares.filter((l) => l.codigo_division === division).map((l) => ({ value: l.id, label: l.nombre })),
    [lugares, division],
  );
  const norm = direccion.trim().length >= 5 ? normalizarDireccion(direccion) : null;
  const rural = sel?.tipo === "corregimiento";

  return (
    <div className="flex flex-col gap-8">
      <Seccion titulo="Dirección">
        <div className="sm:col-span-2">
          <CampoTexto
            name={P + "direccion"}
            label="Dirección del inmueble"
            autoComplete="off"
            hint={norm?.es_completa ? `Se guardará como: ${norm.norm}` : undefined}
          />
        </div>
      </Seccion>

      <Seccion titulo="Ubicación">
        <Controller
          control={control}
          name={P + "codigo_division"}
          render={({ field }) => (
            <Field label="Comuna o corregimiento" hint="Escriba para buscar" error={error(P + "codigo_division")}>
              {(a11y) => (
                <Combobox
                  {...a11y}
                  options={OPCIONES_DIVISION}
                  value={field.value ?? ""}
                  onBlur={field.onBlur}
                  onChange={(v) => {
                    field.onChange(v);
                    // A barrio from another comuna/corregimiento is no longer valid.
                    const id = getValues(P + "id_barrio_vereda");
                    if (id && !lugares.some((l) => l.id === id && l.codigo_division === v))
                      setValue(P + "id_barrio_vereda", "", { shouldDirty: true });
                  }}
                />
              )}
            </Field>
          )}
        />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Sector</p>
          <p className="flex min-h-11 items-center text-base">
            {sel ? `Sector: ${sel.sector === "rural" ? "Rural" : "Urbano"}` : "Se define con la comuna o el corregimiento"}
          </p>
        </div>

        {noListado ? (
          // The schema reports a missing free text on id_barrio_vereda; word it for this input.
          <Field
            label={rural ? "Vereda (escríbala)" : "Barrio (escríbalo)"}
            error={error(P + "id_barrio_vereda") && (rural ? "Escriba el nombre de la vereda" : "Escriba el nombre del barrio")}
          >
            {(a11y) => <TextInput {...a11y} {...register(P + "barrio_vereda_otro")} autoComplete="off" />}
          </Field>
        ) : (
          <Controller
            control={control}
            name={P + "id_barrio_vereda"}
            render={({ field }) => (
              <Field
                label={rural ? "Vereda" : "Barrio o vereda"}
                hint={division ? "Escriba para buscar" : "Primero seleccione la comuna o el corregimiento"}
                error={error(P + "id_barrio_vereda")}
              >
                {(a11y) => (
                  // No onBlur validation: the error line would push "No aparece en la lista" down while it is being clicked.
                  <Combobox {...a11y} options={barrios} value={field.value ?? ""} onChange={field.onChange} disabled={!division} />
                )}
              </Field>
            )}
          />
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end">
          <input
            type="checkbox"
            className="check"
            {...register(P + "barrio_no_listado", {
              onChange: (e) => setValue(e.target.checked ? P + "id_barrio_vereda" : P + "barrio_vereda_otro", ""),
            })}
          />
          No aparece en la lista
        </label>
      </Seccion>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Estrato</h3>
        <RadioGroup legend="Estrato socioeconómico" name={P + "estrato"} options={ESTRATOS} error={error(P + "estrato")} inputProps={register(P + "estrato")} />
      </section>
    </div>
  );
}
