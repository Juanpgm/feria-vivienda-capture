"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { formatoCop } from "@/modules/cierre-financiero/domain/smlmv";
import { PasoConsentimiento } from "@/modules/consentimiento/ui/PasoConsentimiento";
import { SeccionFirma } from "@/modules/firma/ui/SeccionFirma";
import { CampoTexto, Seccion, useError } from "@/modules/registro/ui/campos";
import { parsearIngresoCop } from "@/shared/normalizacion/texto";
import { useAyuda } from "@/shared/ui/Ayuda";
import { Field, TextArea } from "@/shared/ui/Field";
import { RadioGroup } from "@/shared/ui/Radio";
import {
  CODIGOS_FUENTES, ENTIDADES_ACREEDORAS, ESTADOS_OBLIGACION, FUENTES_RECURSOS, MODALIDAD_DEUDORES, MODALIDADES, MODALIDADES_CON_PROYECTO,
  TIPOS_VIVIENDA, opciones, type Modalidad,
} from "../domain/catalogos";
import { AUTORIZACION_GIRO, DECLARACION, DECLARACION_TITULO, DECLARACION_VERSION, NOTA_FORMATO } from "../domain/texto";
import { CampoEntidad, CampoMoneda, CampoSelect } from "./campos";

const P = "postulacion.";

/** Step 3: sections 3, 4, 4.1, 5 and 5.1 of the format; on creation also consent, sworn declaration (6) and signature. */
export function PasoSubsidio({ creacion }: { creacion: boolean }) {
  const { register, setValue } = useFormContext<FieldValues>();
  const error = useError();
  const modalidad = useWatch({ name: P + "modalidad" }) as Modalidad | "";
  const fuentes = (useWatch({ name: P + "fuentes" }) as string[] | undefined) ?? [];
  const recursos = (useWatch({ name: P + "recursos" }) as Record<string, { valor?: string }> | undefined) ?? {};
  const total = fuentes.reduce((s, f) => s + (parsearIngresoCop(recursos[f]?.valor ?? "") ?? 0), 0);
  const ayudaFuentes = useAyuda("Fuentes de recursos");
  const tipo = useWatch({ name: P + "tipo_vivienda" }) as string | undefined;
  // The value of the other project type is 0 (not asked).
  const registroTipo = register(P + "tipo_vivienda");
  const tipoVivienda = {
    ...registroTipo,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(P + (e.target.value === "vis" ? "valor_vip" : "valor_vis"), "0", { shouldDirty: true });
      return registroTipo.onChange(e);
    },
  };

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Modalidad del subsidio</h3>
        <RadioGroup lista legend="Modalidad a la que se postula" name={P + "modalidad"} options={opciones(MODALIDADES)} error={error(P + "modalidad")} inputProps={register(P + "modalidad")} />
        <Field label="Observaciones (opcional)" error={error(P + "observaciones")}>
          {(a11y) => <TextArea {...a11y} rows={3} maxLength={1000} {...register(P + "observaciones")} />}
        </Field>
      </section>

      {modalidad === MODALIDAD_DEUDORES && (
        <Seccion titulo="Datos de la obligación">
          <CampoSelect name={P + "entidad_acreedora"} label="Entidad acreedora" options={opciones(ENTIDADES_ACREEDORAS)} />
          <CampoTexto name={P + "numero_obligacion"} label="Número de obligación o crédito" />
          <CampoTexto name={P + "programa_obligacion"} label="Programa o proyecto de vivienda de la obligación" />
          <CampoMoneda name={P + "saldo_adeudado"} label="Saldo total adeudado" />
          <CampoSelect name={P + "estado_obligacion"} label="Estado de la obligación" options={opciones(ESTADOS_OBLIGACION)} />
          <div className="rounded-lg border border-border bg-surface p-4 sm:col-span-2">
            <p className="mb-2 text-sm font-semibold">Autorización de giro al acreedor</p>
            <p className="mb-3 text-sm">{AUTORIZACION_GIRO}</p>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium">
              <input type="checkbox" className="size-5" {...register(P + "autoriza_giro")} />
              Autorizo
            </label>
          </div>
        </Seccion>
      )}

      {MODALIDADES_CON_PROYECTO.includes(modalidad as Modalidad) && (
        <Seccion titulo="Datos del proyecto de vivienda">
          <CampoTexto name={P + "proyecto_nombre"} label="Nombre del proyecto habitacional" />
          <CampoTexto name={P + "constructora"} label="Nombre de la constructora" />
          <div className="sm:col-span-2">
            <RadioGroup legend="¿A qué tipo de proyecto aplicará?" name={P + "tipo_vivienda"} options={opciones(TIPOS_VIVIENDA)} error={error(P + "tipo_vivienda")} inputProps={tipoVivienda} />
          </div>
          <CampoMoneda name={P + "valor_vis"} label="Valor de la solución de vivienda VIS" disabled={tipo !== "vis"} hint={tipo === "vip" ? "No aplica: el proyecto es VIP (queda en 0)" : tipo ? undefined : "Primero elija el tipo de proyecto"} />
          <CampoMoneda name={P + "valor_vip"} label="Valor de la solución de vivienda VIP" disabled={tipo !== "vip"} hint={tipo === "vis" ? "No aplica: el proyecto es VIS (queda en 0)" : tipo ? undefined : "Primero elija el tipo de proyecto"} />
        </Seccion>
      )}

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Recursos para el cierre financiero</h3>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Fuentes de recursos</legend>
          {ayudaFuentes.boton && <div className="flex items-center">{ayudaFuentes.boton}<span className="text-sm text-muted">¿Qué significa?</span></div>}
          {ayudaFuentes.panel}
          <p className="text-sm text-muted">Marque las fuentes con las que cuenta; para cada una escriba el valor.</p>
          <div className="flex flex-wrap gap-2">
            {CODIGOS_FUENTES.map((f) => (
              <label key={f} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 has-checked:border-2 has-checked:border-primary has-checked:bg-surface">
                <input type="checkbox" value={f} className="size-4" {...register(P + "fuentes")} />
                <span className="font-medium">{FUENTES_RECURSOS[f].etiqueta}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {CODIGOS_FUENTES.filter((f) => fuentes.includes(f)).map((f) => (
          <div key={f} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
            <p className="font-bold sm:col-span-2">{FUENTES_RECURSOS[f].etiqueta}</p>
            <CampoMoneda name={`${P}recursos.${f}.valor`} label={`Valor de ${FUENTES_RECURSOS[f].etiqueta.toLowerCase()}`} />
            <CampoEntidad name={`${P}recursos.${f}.entidad`} label={`${FUENTES_RECURSOS[f].entidad} (${FUENTES_RECURSOS[f].etiqueta.toLowerCase()})`} tipos={FUENTES_RECURSOS[f].tipos} />
            {f === "subsidio_familiar" && <CampoTexto name={`${P}recursos.${f}.resolucion`} label="Resolución o acta y fecha de expedición" />}
          </div>
        ))}
        <div role="status" className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-muted">Total aportes del hogar</p>
          <p className="text-2xl font-bold tabular-nums text-primary-strong">{formatoCop(total)}</p>
        </div>
      </section>

      {creacion && (
        <>
          <section className="flex flex-col gap-4">
            <h3 className="text-lg font-bold text-primary-strong">Autorización de tratamiento de datos</h3>
            <PasoConsentimiento />
          </section>
          <Declaracion />
          <SeccionFirma />
          <p className="text-sm text-muted">{NOTA_FORMATO}</p>
        </>
      )}
    </div>
  );
}

function Declaracion() {
  const { register, setValue } = useFormContext<FieldValues>();
  const error = useError()("declaracion.acepta");
  const r = register("declaracion.acepta");
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold text-primary-strong">{DECLARACION_TITULO}</h3>
      {DECLARACION.map((p) => (
        <p key={p.slice(0, 20)}>{p}</p>
      ))}
      <label className="flex min-h-11 cursor-pointer items-start gap-3 font-medium">
        <input
          type="checkbox"
          className="mt-1 size-5"
          aria-invalid={error ? true : undefined}
          {...r}
          onChange={(e) => {
            void r.onChange(e);
            setValue("declaracion.version", e.target.checked ? DECLARACION_VERSION : "", { shouldDirty: true });
          }}
        />
        Declaro bajo la gravedad de juramento que la información es verídica y acepto lo anterior
      </label>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </section>
  );
}
