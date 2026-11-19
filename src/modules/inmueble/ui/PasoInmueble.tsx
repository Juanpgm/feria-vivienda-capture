"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import type { OpcionBusqueda } from "@/shared/busqueda";
import { normalizarDireccion } from "@/shared/normalizacion/direccion";
import { Combobox } from "@/shared/ui/Combobox";
import { Field } from "@/shared/ui/Field";
import { RadioGroup } from "@/shared/ui/Radio";
import { CampoTexto, Seccion, useError } from "@/modules/registro/ui/campos";
import divisiones from "../catalogo/divisiones.json";

type Lugar = { id: string; nombre: string; codigo_division: string };

const OPCIONES_DIVISION: OpcionBusqueda[] = divisiones.map((d) => ({
  value: d.codigo,
  label: d.tipo === "comuna" ? d.nombre : `Corregimiento ${d.nombre}`,
  keywords: d.nombre,
}));
const ESTRATOS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }));

type Deteccion = typeof import("../domain/ubicacion");

/** What the geocoder of the Alcaldía answers for an address (see modules/inmueble/server/geocodificar.ts). */
export type UbicacionGeocodificada = {
  direccion_catastral: string | null;
  id_barrio_vereda: string | null;
  nombre_barrio_vereda: string | null;
  codigo_division: string | null;
  latitud: number | null;
  longitud: number | null;
};
type Estado = { tipo: "buscando" } | { tipo: "hallado"; fuente: "alcaldia" | "texto"; id: string; nombre: string } | { tipo: "no_hallado" } | null;

/**
 * `prefijo`: form section holding direccion / codigo_division / id_barrio_vereda / estrato (reused by the postulación form).
 * `ubicar`: when given, the address is located on blur (geocoder of the Alcaldía first, then a barrio named in the text) and
 * pre-fills comuna and barrio, which stay editable; the estrato then comes from the barrio and is asked only when unknown.
 */
export function PasoInmueble({
  prefijo: P = "inmueble.", etiquetaDireccion = "Dirección del inmueble", ubicar,
}: { prefijo?: string; etiquetaDireccion?: string; ubicar?: (direccion: string) => Promise<UbicacionGeocodificada | null> } = {}) {
  const { register, setValue, getValues, control } = useFormContext<FieldValues>();
  const error = useError();
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const division = (useWatch({ control, name: P + "codigo_division" }) as string | undefined) ?? "";
  const direccion = (useWatch({ control, name: P + "direccion" }) as string | undefined) ?? "";
  const catastral = (useWatch({ control, name: P + "direccion_catastral" }) as string | undefined) ?? "";
  const barrio = (useWatch({ control, name: P + "id_barrio_vereda" }) as string | undefined) ?? "";
  const norm = direccion.trim().length >= 5 ? normalizarDireccion(direccion) : null;

  useEffect(() => {
    import("../catalogo/barrios.json").then((m) => setLugares(m.default));
  }, []);

  const [deteccion, setDeteccion] = useState<Deteccion | null>(null);
  useEffect(() => {
    if (ubicar) import("../domain/ubicacion").then(setDeteccion);
  }, [ubicar]);
  const estratoAuto = deteccion?.estratoDeBarrio(barrio) ?? null;
  const [estado, setEstado] = useState<Estado>(null);
  // The barrio last filled in automatically: a later address may replace it; a barrio chosen by hand is never overwritten.
  const automatico = useRef("");
  const consulta = useRef(0);

  useEffect(() => {
    if (estratoAuto && getValues(P + "estrato") !== String(estratoAuto)) setValue(P + "estrato", String(estratoAuto), { shouldDirty: true, shouldValidate: true });
  }, [estratoAuto, P, getValues, setValue]);

  // Coordinates belong to the barrio they were found in: a barrio chosen by hand drops them.
  useEffect(() => {
    if (ubicar && barrio !== automatico.current && getValues(P + "latitud")) {
      setValue(P + "latitud", "");
      setValue(P + "longitud", "");
    }
  }, [barrio, ubicar, P, getValues, setValue]);

  function aplicar(id: string, codigoDivision: string, nombre: string, fuente: "alcaldia" | "texto") {
    automatico.current = id;
    setValue(P + "codigo_division", codigoDivision, { shouldDirty: true, shouldValidate: true });
    setValue(P + "id_barrio_vereda", id, { shouldDirty: true, shouldValidate: true });
    setEstado({ tipo: "hallado", fuente, id, nombre });
  }

  async function alSalirDireccion(valor: string) {
    if (!ubicar || valor.trim().length < 5) return;
    const actual = getValues(P + "id_barrio_vereda");
    const manual = !!actual && actual !== automatico.current;
    const n = ++consulta.current;
    setEstado({ tipo: "buscando" });
    const g = await ubicar(valor).catch(() => null);
    if (n !== consulta.current) return; // a newer address was typed meanwhile
    setValue(P + "direccion_catastral", g?.direccion_catastral ?? "");
    const enTexto = deteccion?.detectarBarrio(valor);
    if (manual) return setEstado(null);
    if (g?.id_barrio_vereda && g.codigo_division) {
      setValue(P + "latitud", g.latitud ?? "");
      setValue(P + "longitud", g.longitud ?? "");
      return aplicar(g.id_barrio_vereda, g.codigo_division, g.nombre_barrio_vereda ?? "", "alcaldia");
    }
    setValue(P + "latitud", "");
    setValue(P + "longitud", "");
    if (enTexto) return aplicar(enTexto.id, enTexto.codigo_division, enTexto.nombre, "texto");
    setEstado({ tipo: "no_hallado" });
  }

  const avisoUbicacion =
    !ubicar || !estado ? undefined
    : estado.tipo === "buscando" ? "Buscando la comuna y el barrio de esta dirección…"
    : estado.tipo === "no_hallado" ? "No pudimos ubicar la dirección: elija la comuna y el barrio de la lista (o escriba el barrio al final de la dirección, por ejemplo «Barrio Centenario»)."
    : barrio === estado.id ? `Ubicamos la dirección en el barrio ${estado.nombre}${estado.fuente === "alcaldia" ? " (geocodificador de la Alcaldía)" : ""} y lo seleccionamos abajo. Cámbielo si no es correcto.`
    : undefined;

  const sel = divisiones.find((d) => d.codigo === division);
  const barrios = useMemo(
    () => lugares.filter((l) => l.codigo_division === division).map((l) => ({ value: l.id, label: l.nombre })),
    [lugares, division],
  );
  const rural = sel?.tipo === "corregimiento";

  return (
    <div className="flex flex-col gap-8">
      <Seccion sub titulo="Dirección">
        <div className="sm:col-span-2">
          <CampoTexto
            name={P + "direccion"}
            label={etiquetaDireccion}
            autoComplete="off"
            hint={catastral ? `Dirección catastral: ${catastral}` : norm?.es_completa ? `Se guardará como: ${norm.norm}` : undefined}
            alSalir={ubicar ? alSalirDireccion : undefined}
          />
          {avisoUbicacion && (
            <p role="status" className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm">
              {avisoUbicacion}
            </p>
          )}
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
        {estratoAuto ? (
          <p role="status" data-testid="estrato-automatico" className="text-base">
            <strong>Estrato {estratoAuto}</strong>: es el estrato moda del barrio seleccionado (Planeación Distrital de Cali). Se calcula solo.
          </p>
        ) : (
          <>
            {ubicar && barrio && <p className="text-sm text-muted">No tenemos el estrato de este lugar: indíquelo.</p>}
            <RadioGroup legend="Estrato socioeconómico" name={P + "estrato"} options={ESTRATOS} error={error(P + "estrato")} inputProps={register(P + "estrato")} />
          </>
        )}
      </section>
    </div>
  );
}
