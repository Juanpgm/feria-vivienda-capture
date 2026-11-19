"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import type { OpcionBusqueda } from "@/shared/busqueda";
import { normalizarDireccion } from "@/shared/normalizacion/direccion";
import { Combobox } from "@/shared/ui/Combobox";
import { Field } from "@/shared/ui/Field";
import { Button } from "@/shared/ui/Button";
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
type Hallazgo = { id: string; codigo_division: string; nombre: string; fuente: "alcaldia" | "texto"; latitud: number | null; longitud: number | null };
type Estado = { tipo: "buscando" } | { tipo: "hallado" | "sugerencia"; h: Hallazgo } | { tipo: "no_hallado" } | null;

/** Worth locating: has a house number ("# 38-20", "38 - 20"). Shorter text is still being typed. */
export const direccionCompleta = (d: string) => /#\s*\d|\d+\s*-\s*\d+/.test(d) && d.trim().length >= 8;
/** Pause after the last keystroke before locating the address. */
const PAUSA_MS = 1000;

/**
 * `prefijo`: form section holding direccion / codigo_division / id_barrio_vereda / estrato (reused by the postulación form).
 * `ubicar`: when given, the address is located as soon as the person stops typing it (or leaves the field, or presses
 * "Buscar ubicación"): geocoder of the Alcaldía first, then a barrio named in the text. It pre-fills comuna and barrio,
 * which stay editable; a barrio chosen by hand is never replaced, a different result is offered instead. The estrato then
 * comes from the barrio and is asked only when unknown.
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

  function aplicar(h: Hallazgo) {
    automatico.current = h.id;
    setValue(P + "latitud", h.latitud ?? "");
    setValue(P + "longitud", h.longitud ?? "");
    setValue(P + "codigo_division", h.codigo_division, { shouldDirty: true, shouldValidate: true });
    setValue(P + "id_barrio_vereda", h.id, { shouldDirty: true, shouldValidate: true });
    setEstado({ tipo: "hallado", h });
  }

  const buscada = useRef(""); // last address located, so blur + pause + button do not repeat the same request
  async function buscar(valor: string, forzar = false) {
    const q = valor.trim();
    if (!ubicar || q.length < 5 || (!forzar && q === buscada.current)) return;
    buscada.current = q;
    const n = ++consulta.current;
    setEstado({ tipo: "buscando" });
    const g = await ubicar(q).catch(() => null);
    if (n !== consulta.current) return; // a newer address was typed meanwhile
    setValue(P + "direccion_catastral", g?.direccion_catastral ?? "");
    const enTexto = (deteccion ?? (await import("../domain/ubicacion"))).detectarBarrio(q);
    const h: Hallazgo | null =
      g?.id_barrio_vereda && g.codigo_division
        ? { id: g.id_barrio_vereda, codigo_division: g.codigo_division, nombre: g.nombre_barrio_vereda ?? "", fuente: "alcaldia", latitud: g.latitud, longitud: g.longitud }
        : enTexto ? { ...enTexto, fuente: "texto", latitud: null, longitud: null } : null;
    if (!h) return setEstado({ tipo: "no_hallado" });
    const actual = getValues(P + "id_barrio_vereda");
    if (actual && actual !== automatico.current && actual !== h.id) return setEstado({ tipo: "sugerencia", h });
    aplicar(h);
  }

  // Locate as soon as the address looks finished and the person paused typing.
  const buscarRef = useRef(buscar);
  useEffect(() => {
    buscarRef.current = buscar;
  });
  useEffect(() => {
    if (!ubicar || !direccionCompleta(direccion)) return;
    const t = setTimeout(() => void buscarRef.current(direccion), PAUSA_MS);
    return () => clearTimeout(t);
  }, [direccion, ubicar]);

  const buscando = estado?.tipo === "buscando";
  // Postulación: comuna and barrio appear only once the address was located (pre-filled, editable) or could not be
  // located (to be chosen by hand); never without an address. The estrato appears with the barrio.
  const hayDireccion = direccion.trim().length >= 5;
  const mostrarUbicacion = !ubicar || (hayDireccion && (!!division || !!barrio || estado?.tipo === "no_hallado" || estado?.tipo === "sugerencia"));
  const mostrarEstrato = !ubicar || (mostrarUbicacion && !!barrio);

  // Address erased: what was found for it no longer applies.
  const { subscribe } = useFormContext<FieldValues>();
  useEffect(() => {
    if (!ubicar) return;
    return subscribe({
      name: P + "direccion",
      formState: { values: true },
      callback: ({ values }) => {
        const v = String((values as Record<string, Record<string, unknown>>)[P.slice(0, -1)]?.direccion ?? "");
        if (v.trim()) return;
        consulta.current++;
        buscada.current = "";
        automatico.current = "";
        setEstado(null);
        for (const k of ["codigo_division", "id_barrio_vereda", "estrato", "latitud", "longitud", "direccion_catastral"]) if (getValues(P + k)) setValue(P + k, "", { shouldDirty: true });
      },
    });
  }, [ubicar, subscribe, P, getValues, setValue]);
  const desde = (h: Hallazgo) => (h.fuente === "alcaldia" ? " (geocodificador de la Alcaldía)" : " (barrio escrito en la dirección)");
  const avisoUbicacion =
    !ubicar || !estado ? null
    : estado.tipo === "buscando" ? <>Buscando la comuna y el barrio de esta dirección… espere un momento.</>
    : estado.tipo === "no_hallado" ? <>No pudimos ubicar la dirección: elija la comuna y el barrio de la lista (o escriba el barrio al final de la dirección, por ejemplo «Barrio Centenario», y busque de nuevo).</>
    : estado.tipo === "sugerencia" ? (
      <>
        Según la dirección, el barrio es <strong>{estado.h.nombre}</strong>{desde(estado.h)}, pero usted eligió otro.{" "}
        <button type="button" onClick={() => aplicar(estado.h)} className="font-semibold text-primary underline underline-offset-2">
          Usar {estado.h.nombre}
        </button>
      </>
    )
    : barrio === estado.h.id ? <>Ubicamos la dirección en el barrio {estado.h.nombre}{desde(estado.h)} y lo seleccionamos abajo. Cámbielo si no es correcto.</>
    : null;

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
            alSalir={ubicar ? (v) => void buscar(v) : undefined}
          />
          {ubicar && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button variant="secondary" disabled={buscando || direccion.trim().length < 5} onClick={() => void buscar(direccion, true)}>
                {buscando ? "Buscando…" : "Buscar ubicación"}
              </Button>
              <span className="text-sm text-muted">Buscamos la comuna y el barrio en cuanto termine de escribir la dirección.</span>
            </div>
          )}
          {avisoUbicacion && (
            <p role="status" data-testid="aviso-ubicacion" className={`mt-2 rounded-lg border p-3 text-sm ${buscando ? "border-primary bg-surface font-semibold" : "border-border bg-surface"}`}>
              {buscando && <span aria-hidden="true" className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-primary border-t-transparent align-middle" />}
              {avisoUbicacion}
            </p>
          )}
        </div>
      </Seccion>

      {mostrarUbicacion && (
      <Seccion sub titulo="Ubicación">
        <Controller
          control={control}
          name={P + "codigo_division"}
          render={({ field }) => (
            <Field label="Comuna o corregimiento" hint="Escriba para buscar" error={error(P + "codigo_division")}>
              {(a11y) => (
                <Combobox
                  {...a11y}
                  name={field.name}
                  disabled={buscando}
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
                <Combobox {...a11y} name={field.name} options={barrios} value={field.value ?? ""} onChange={field.onChange} alDescartarTexto={field.onBlur} disabled={!division || buscando} />
              )}
            </Field>
          )}
        />
      </Seccion>
      )}

      {mostrarEstrato && (
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
      )}
    </div>
  );
}
