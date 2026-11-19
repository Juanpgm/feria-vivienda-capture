"use client";

import { useFieldArray, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { derivarIngreso, formatoCop, RANGOS_SMLMV } from "@/modules/cierre-financiero/domain/smlmv";
import { CampoFecha } from "@/modules/registro/ui/CampoFecha";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";
import { normalizarDocumento, normalizarNombre, parsearIngresoCop } from "@/shared/normalizacion/texto";
import { fechaBogota } from "@/shared/tiempo";
import { Button } from "@/shared/ui/Button";
import {
  CONDICIONES_ESPECIALES, ESTADOS_CIVILES, IDENTIDADES_GENERO, MAX_INTEGRANTES, OCUPACIONES_INTEGRANTE, PARENTESCOS, TIPOS_DOCUMENTO_INTEGRANTE, opciones,
} from "../domain/catalogos";
import { INTEGRANTE_VACIO } from "../domain/formulario";
import { CampoMoneda, CampoSelect } from "./campos";

const pesos = (v: unknown) => (typeof v === "string" ? (parsearIngresoCop(v) ?? 0) : 0);

/** Step 2: section 2 of the format. One card per household member (the applicant is not repeated here). */
export function PasoHogar() {
  const { control } = useFormContext<FieldValues>();
  const error = useError();
  const { fields, append, remove } = useFieldArray({ control, name: "hogar.integrantes" });
  const integrantes = (useWatch({ name: "hogar.integrantes" }) as Record<string, unknown>[] | undefined) ?? [];
  const ingresoSolicitante = useWatch({ name: "solicitante.ingreso_mensual" });
  const total = pesos(ingresoSolicitante) + integrantes.reduce((s, m) => s + pesos(m.ingresos), 0);
  const rango = RANGOS_SMLMV.find((r) => r.codigo === derivarIngreso(total).rango_ingresos_smlmv);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">Agréguelas en este orden: cónyuge o compañero(a), hijos y otros familiares. Usted ya está registrado como jefe del hogar.</p>
      {error("hogar.integrantes") && <p role="alert" className="font-medium text-danger">{error("hogar.integrantes")}</p>}

      {fields.map((f, i) => {
        const P = `hogar.integrantes.${i}.`;
        const m = integrantes[i] ?? {};
        const nombre = String(m.nombres_apellidos ?? "").trim();
        const parentesco = PARENTESCOS[String(m.parentesco ?? "") as keyof typeof PARENTESCOS];
        const iniciales = nombre.split(/s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || String(i + 1);
        return (
          <section key={f.id} aria-labelledby={`integrante-${f.id}`} className="flex flex-col gap-5 rounded-xl border border-border bg-bg p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface font-bold text-primary-strong ring-2 ring-accent">{iniciales}</span>
                <div className="min-w-0">
                  <h3 id={`integrante-${f.id}`} className="font-bold text-primary-strong">
                    Integrante {i + 1}
                  </h3>
                  <p className="truncate text-sm text-muted">{nombre ? `${nombre}${parentesco ? `, ${parentesco.toLowerCase()}` : ""}` : "Escriba sus datos"}</p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => remove(i)} aria-label={`Quitar integrante ${i + 1}`}>
                Quitar
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CampoTexto name={P + "nombres_apellidos"} label="Nombres y apellidos completos" normalizar={(v) => (v.trim() ? normalizarNombre(v) : null)} />
              </div>
              <CampoFecha name={P + "fecha_nacimiento"} label="Fecha de nacimiento del integrante" max={fechaBogota()} mensajeMax="La fecha de nacimiento no puede ser futura" />
              <CampoSelect name={P + "parentesco"} label="Parentesco con el jefe del hogar" options={opciones(PARENTESCOS)} />
              <CampoSelect name={P + "tipo_documento"} label="Tipo de documento (TD)" options={opciones(TIPOS_DOCUMENTO_INTEGRANTE)} />
              <CampoTexto name={P + "numero_documento"} label="Número de documento del integrante" inputMode="numeric" normalizar={(v) => normalizarDocumento(v) || null} />
              <CampoSelect name={P + "estado_civil"} label="Estado civil" options={opciones(ESTADOS_CIVILES)} />
              <CampoSelect name={P + "ocupacion"} label="Ocupación del integrante" options={opciones(OCUPACIONES_INTEGRANTE)} />
              <CampoSelect name={P + "identidad_genero"} label="Identidad de género" options={opciones(IDENTIDADES_GENERO)} />
              <CampoSelect name={P + "condicion_especial"} label="Condición especial del integrante" options={opciones(CONDICIONES_ESPECIALES)} />
              <CampoMoneda name={P + "ingresos"} label="Ingresos mensuales del integrante" hint="Escriba 0 si no tiene ingresos" />
            </div>
          </section>
        );
      })}

      {fields.length < MAX_INTEGRANTES ? (
        <button
          type="button"
          onClick={() => append({ ...INTEGRANTE_VACIO })}
          className="flex min-h-16 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border font-semibold text-primary hover:border-primary hover:bg-surface"
        >
          + Agregar integrante
        </button>
      ) : (
        <p className="text-sm text-muted">El formato admite hasta {MAX_INTEGRANTES} integrantes.</p>
      )}

      <div role="status" className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-muted">Total ingresos del grupo familiar (incluye al solicitante)</p>
        <p className="text-2xl font-bold tabular-nums text-primary-strong">{formatoCop(total)}</p>
        <p className="text-sm text-muted">
          {fields.length + 1} {fields.length ? "personas" : "persona"}, {rango?.etiqueta}
        </p>
      </div>
    </div>
  );
}
