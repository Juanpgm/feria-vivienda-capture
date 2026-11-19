"use client";

// How complete the postulación is, counted straight from the form so it works on any step: what validation needs
// (see faltantes.ts) plus photos, authorization and signature. Shown as one thin bar at the top of the form.
import { useWatch } from "react-hook-form";
import { FOTO_CAPTURADA } from "@/modules/documentos/domain/schema";
import type { Valores } from "../domain/armar";

const lleno = (x: unknown) => x !== undefined && x !== null && String(x).trim() !== "";
const DEL_SOLICITANTE = [
  "nombres", "apellidos", "fecha_nacimiento", "telefono", "lugar_expedicion", "fecha_expedicion", "lugar_nacimiento", "ingreso_mensual",
  "genero", "ocupacion", "direccion", "codigo_division", "id_barrio_vereda", "estrato", "anios_residencia", "notificacion_electronica", "caja_compensacion", "sisben",
];
const DEL_INTEGRANTE = ["nombres_apellidos", "fecha_nacimiento", "tipo_documento", "numero_documento", "parentesco", "ingresos"];

/** `{ avance: 0-100, faltan }` of the whole postulación. */
export function useAvance() {
  const v = (useWatch() ?? {}) as Valores;
  const s = v.solicitante ?? {};
  const piezas = [
    ...DEL_SOLICITANTE.map((k) => lleno(s[k])),
    v.documentos?.documento_frente === FOTO_CAPTURADA && v.documentos?.documento_reverso === FOTO_CAPTURADA,
    lleno(v.postulacion?.modalidad),
    v.consentimiento?.acepta_tratamiento === true && v.declaracion?.acepta === true,
    !!v.firma?.metodo_firma && !!v.firma?.sello,
    ...((v.hogar?.integrantes ?? []) as Record<string, unknown>[]).flatMap((m) => DEL_INTEGRANTE.map((k) => lleno(m[k]))),
  ];
  const faltan = piezas.filter((x) => !x).length;
  return { avance: Math.round(((piezas.length - faltan) / piezas.length) * 100), faltan };
}

export function BarraAvance() {
  const { avance, faltan } = useAvance();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs sm:text-sm">
        <span className="font-semibold">{avance === 100 ? "Postulación completa" : `${avance} % completa`}</span>
        {faltan > 0 && <span className="text-muted">{faltan === 1 ? "falta 1 dato" : `faltan ${faltan} datos`}</span>}
      </div>
      <div
        role="progressbar"
        aria-label="Avance de la postulación"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={avance}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${avance}%` }} />
      </div>
    </div>
  );
}
