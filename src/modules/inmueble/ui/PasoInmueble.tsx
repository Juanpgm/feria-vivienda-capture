"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import type { OpcionBusqueda } from "@/shared/busqueda";
import { normalizarDireccion } from "@/shared/normalizacion/direccion";
import { Combobox } from "@/shared/ui/Combobox";
import { Field } from "@/shared/ui/Field";
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
      <Seccion sub titulo="Dirección">
        <div className="sm:col-span-2">
          <CampoTexto
            name={P + "direccion"}
            label="Dirección del inmueble"
            autoComplete="off"
            hint={norm?.es_completa ? `Se guardará como: ${norm.norm}` : undefined}
          />
        </div>
      </Seccion>

      <Seccion sub titulo="Ubicación">
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

        <Controller
          control={control}
          name={P + "id_barrio_vereda"}
          render={({ field }) => (
            <Field
              label={rural ? "Vereda" : "Barrio o vereda"}
              hint={division ? "Escriba para buscar y elija de la lista" : "Primero seleccione la comuna o el corregimiento"}
              error={error(P + "id_barrio_vereda")}
            >
              {(a11y) => (
                // Validates on blur only when typed text was discarded: an error line appearing on every blur would
                // shift the layout under a click aimed at the fields below.
                <Combobox {...a11y} options={barrios} value={field.value ?? ""} onChange={field.onChange} alDescartarTexto={field.onBlur} disabled={!division} />
              )}
            </Field>
          )}
        />
      </Seccion>

      <section className="flex flex-col gap-4">
        <h4 className="text-lg font-bold text-primary-strong">Estrato</h4>
        <RadioGroup legend="Estrato socioeconómico" name={P + "estrato"} options={ESTRATOS} error={error(P + "estrato")} inputProps={register(P + "estrato")} />
      </section>
    </div>
  );
}
