"use client";

// Live "ficha de postulación": the file the household hands to the Secretaría, filling in as the form is answered.
// It answers the two questions people keep asking themselves while filling a long form: "what have I given?" and
// "how much is left?". Desktop: sticky beside the form. Mobile: a compact bar that expands.
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { derivarIngreso, formatoCop, RANGOS_SMLMV } from "@/modules/cierre-financiero/domain/smlmv";
import { FOTO_CAPTURADA } from "@/modules/documentos/domain/schema";
import barrios from "@/modules/inmueble/catalogo/barrios.json";
import divisiones from "@/modules/inmueble/catalogo/divisiones.json";
import { parsearIngresoCop } from "@/shared/normalizacion/texto";
import type { Valores } from "../domain/armar";
import { MODALIDADES, type Modalidad } from "../domain/catalogos";

const lleno = (x: unknown) => x !== undefined && x !== null && String(x).trim() !== "";
/** What validation needs (see faltantes.ts), counted straight from the form so it works on any step. */
const DEL_SOLICITANTE = [
  "nombres", "apellidos", "fecha_nacimiento", "telefono", "lugar_expedicion", "fecha_expedicion", "lugar_nacimiento", "ingreso_mensual",
  "genero", "ocupacion", "direccion", "codigo_division", "id_barrio_vereda", "estrato", "anios_residencia", "notificacion_electronica", "caja_compensacion", "sisben",
];

const BARRIOS = new Map(barrios.map((b) => [b.id, b.nombre]));
const DIVISIONES = new Map(divisiones.map((d) => [d.codigo, d.tipo === "comuna" ? d.nombre : `Corregimiento ${d.nombre}`]));

function useFicha() {
  const v = (useWatch() ?? {}) as Valores;
  const s = v.solicitante ?? {};
  const fotos = v.documentos?.documento_frente === FOTO_CAPTURADA && v.documentos?.documento_reverso === FOTO_CAPTURADA;
  const firmada = !!v.firma?.metodo_firma && !!v.firma?.sello;
  const integrantes = (v.hogar?.integrantes ?? []) as Record<string, unknown>[];
  const piezas = [
    ...DEL_SOLICITANTE.map((k) => lleno(s[k])),
    fotos,
    lleno(v.postulacion?.modalidad),
    v.consentimiento?.acepta_tratamiento === true && v.declaracion?.acepta === true,
    firmada,
    ...integrantes.flatMap((m) => ["nombres_apellidos", "fecha_nacimiento", "tipo_documento", "numero_documento", "parentesco", "ingresos"].map((k) => lleno(m[k]))),
  ];
  const faltan = piezas.filter((x) => !x).length;
  const avance = Math.round(((piezas.length - faltan) / piezas.length) * 100);
  const nombre = [s.nombres, s.apellidos].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ");
  const ingresos = [s.ingreso_mensual, ...integrantes.map((m) => m.ingresos)].reduce<number>((t, x) => t + (parsearIngresoCop(String(x ?? "")) ?? 0), 0);
  const aportes = ((v.postulacion?.fuentes ?? []) as string[]).reduce((t, f) => t + (parsearIngresoCop(String((v.postulacion?.recursos as Record<string, { valor?: string }> | undefined)?.[f]?.valor ?? "")) ?? 0), 0);
  return { v, s, fotos, firmada, faltan, avance, nombre, ingresos, aportes, personas: integrantes.length + 1 };
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  const vacio = valor === null || valor === undefined || valor === "";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-muted">{etiqueta}</dt>
      <dd className={`text-right text-sm ${vacio ? "text-muted" : "font-semibold"}`}>{vacio ? "Por completar" : valor}</dd>
    </div>
  );
}

function Medidor({ avance, faltan }: { avance: number; faltan: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{avance === 100 ? "Completa" : `${avance} % completa`}</span>
        {faltan > 0 && <span className="text-sm text-muted">{faltan === 1 ? "falta 1 dato" : `faltan ${faltan} datos`}</span>}
      </div>
      <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${avance}%` }} />
      </div>
    </div>
  );
}

function Datos({ documento }: { documento: string }) {
  const { s, fotos, firmada, v, ingresos, aportes, personas } = useFicha();
  const lugar = BARRIOS.get(String(s.id_barrio_vereda ?? ""));
  const division = DIVISIONES.get(String(s.codigo_division ?? ""));
  const modalidad = String(v.postulacion?.modalidad ?? "") as Modalidad | "";
  const rango = ingresos > 0 ? RANGOS_SMLMV.find((x) => x.codigo === derivarIngreso(ingresos).rango_ingresos_smlmv)?.etiqueta : null;
  return (
    <dl className="divide-y divide-border">
      <Dato etiqueta="Documento" valor={`${String(s.tipo_documento ?? "cc").toUpperCase()} ${documento}`} />
      <Dato etiqueta="Vive en" valor={lugar ? `${lugar}${division ? `, ${division}` : ""}` : null} />
      <Dato etiqueta="Personas en el hogar" valor={personas} />
      <Dato etiqueta="Ingresos del hogar" valor={ingresos > 0 ? <>{formatoCop(ingresos)}<span className="block text-xs font-normal text-muted">{rango}</span></> : null} />
      <Dato etiqueta="Modalidad" valor={modalidad ? `${modalidad}. ${MODALIDADES[modalidad]}` : null} />
      <Dato etiqueta="Aportes declarados" valor={aportes > 0 ? formatoCop(aportes) : null} />
      <Dato etiqueta="Fotos del documento" valor={fotos ? "Frente y reverso" : null} />
      <Dato etiqueta="Firma" valor={firmada ? "Registrada" : null} />
    </dl>
  );
}

/** Mobile: a compact bar with the meter; tap to see the whole ficha. */
export function Ficha({ documento }: { documento: string }) {
  const { faltan, avance, nombre } = useFicha();
  const [abierta, setAbierta] = useState(false);
  return (
    <section aria-label="Su postulación, resumen" className="mb-8 rounded-xl border border-border bg-surface lg:hidden">
      <button type="button" aria-expanded={abierta} onClick={() => setAbierta((x) => !x)} className="flex w-full flex-col gap-2 p-4 text-left">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate font-bold text-primary-strong">{nombre || "Su postulación"}</span>
          <span className="shrink-0 text-sm font-semibold text-primary underline underline-offset-2">{abierta ? "Ocultar ficha" : "Ver ficha"}</span>
        </span>
        <Medidor avance={avance} faltan={faltan} />
      </button>
      {abierta && <div className="border-t border-border px-4 pb-4"><Datos documento={documento} /></div>}
    </section>
  );
}

/** Desktop: the ficha itself, sticky beside the form. */
export function FichaEscritorio({ documento }: { documento: string }) {
  const { faltan, avance, nombre } = useFicha();
  return (
    <aside aria-label="Su postulación" className="sticky top-6 overflow-hidden rounded-xl border border-border bg-bg shadow-[0_18px_40px_-24px_rgb(0_54_95/0.55)]">
      <div className="relative bg-[#00365f] px-5 pb-5 pt-4 text-white">
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
        <p className="text-sm text-white/80">Ficha de postulación</p>
        <p className="mt-1 text-xl font-bold leading-tight">{nombre || "Sin nombre todavía"}</p>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <Medidor avance={avance} faltan={faltan} />
        <Datos documento={documento} />
        <p className="text-xs text-muted">Se guarda en este equipo mientras la diligencia. El número de registro se asigna al enviarla.</p>
      </div>
    </aside>
  );
}
