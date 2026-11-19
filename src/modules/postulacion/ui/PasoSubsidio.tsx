"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { formatoCop } from "@/modules/cierre-financiero/domain/smlmv";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";
import { parsearIngresoCop } from "@/shared/normalizacion/texto";
import { useAyuda } from "@/shared/ui/Ayuda";
import { Field, TextArea } from "@/shared/ui/Field";
import { RadioGroup } from "@/shared/ui/Radio";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import {
  CODIGOS_FUENTES, ENTIDADES_ACREEDORAS, ESTADOS_OBLIGACION, FUENTES_RECURSOS, MODALIDAD_DEUDORES, MODALIDADES, MODALIDADES_CON_PROYECTO,
  TIPOS_VIVIENDA, opciones, type Modalidad,
} from "../domain/catalogos";
import { AUTORIZACION_GIRO, DECLARACION, DECLARACION_TITULO, DECLARACION_VERSION, NOTA_FORMATO } from "../domain/texto";
import { CampoEntidad, CampoMoneda, CampoSelect, Grupo } from "./campos";
import { FirmaPostulacion } from "./FirmaPostulacion";

const P = "postulacion.";

/** Step 3: sections 3, 4, 4.1, 5 and 5.1 of the format; on creation also consent, sworn declaration (6) and signature. */
export function PasoSubsidio({ creacion }: { creacion: boolean }) {
  const { register, setValue, getValues, setFocus } = useFormContext<FieldValues>();
  const registroFuentes = register(P + "fuentes");
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
      const elegido = P + (e.target.value === "vis" ? "valor_vis" : "valor_vip");
      setValue(P + (e.target.value === "vis" ? "valor_vip" : "valor_vis"), "0", { shouldDirty: true });
      // The 0 left by the other choice is not a value the person typed.
      if (getValues(elegido) === "0") setValue(elegido, "", { shouldDirty: true });
      return registroTipo.onChange(e);
    },
  };

  return (
    <div className="flex flex-col gap-8">
      <Grupo titulo="Modalidad del subsidio" columnas={false} descripcion="Elija el tipo de subsidio que solicita. Según la modalidad le pediremos los datos que correspondan.">
        <RadioGroup lista legend="Modalidad a la que se postula" name={P + "modalidad"} options={opciones(MODALIDADES)} error={error(P + "modalidad")} inputProps={register(P + "modalidad")} />
        <Field label="Observaciones (opcional)" error={error(P + "observaciones")}>
          {(a11y) => <TextArea {...a11y} rows={3} maxLength={1000} {...register(P + "observaciones")} />}
        </Field>
      </Grupo>

      {modalidad === MODALIDAD_DEUDORES && (
        <Grupo titulo="Datos de la obligación" descripcion="Solo para quien debe un crédito de vivienda al FEV o a la Secretaría de Vivienda.">
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
        </Grupo>
      )}

      {MODALIDADES_CON_PROYECTO.includes(modalidad as Modalidad) && (
        <Grupo titulo="Datos del proyecto de vivienda" descripcion="La vivienda que quiere adquirir.">
          <CampoTexto name={P + "proyecto_nombre"} label="Nombre del proyecto habitacional" />
          <CampoTexto name={P + "constructora"} label="Nombre de la constructora" />
          <div className="sm:col-span-2">
            <SegmentedControl legend="¿A qué tipo de proyecto aplicará?" name={P + "tipo_vivienda"} options={opciones(TIPOS_VIVIENDA)} error={error(P + "tipo_vivienda")} inputProps={tipoVivienda} />
          </div>
          {/* Only the value of the chosen type is asked; the other one is stored as 0. */}
          {tipo === "vis" && <CampoMoneda name={P + "valor_vis"} label="Valor de la solución de vivienda VIS" />}
          {tipo === "vip" && <CampoMoneda name={P + "valor_vip"} label="Valor de la solución de vivienda VIP" />}
        </Grupo>
      )}

      <Grupo titulo="Recursos para el cierre financiero" columnas={false} descripcion="El dinero con que cuenta para completar el valor de la vivienda.">
        {/* Each source opens its own fields right under it: no going up and down between the list and the values. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Fuentes de recursos</legend>
          {ayudaFuentes.boton && <div className="flex items-center">{ayudaFuentes.boton}<span className="text-sm text-muted">¿Qué significa?</span></div>}
          {ayudaFuentes.panel}
          <p className="mb-1 text-sm text-muted">Marque cada fuente con la que cuenta y escriba su valor ahí mismo.</p>
          <ul className="flex flex-col gap-2">
            {CODIGOS_FUENTES.map((f) => {
              const activa = fuentes.includes(f);
              const valor = parsearIngresoCop(recursos[f]?.valor ?? "");
              return (
                <li key={f} className={`rounded-xl border transition-colors ${activa ? "border-primary bg-bg" : "border-border bg-bg hover:bg-surface"}`}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
                    <input
                      type="checkbox"
                      value={f}
                      className="size-5 shrink-0"
                      {...registroFuentes}
                      onChange={(e) => {
                        void registroFuentes.onChange(e);
                        if (e.target.checked) requestAnimationFrame(() => setFocus(`${P}recursos.${f}.valor`));
                      }}
                    />
                    <span className="flex-1 font-semibold">{FUENTES_RECURSOS[f].etiqueta}</span>
                    {activa && valor ? <span className="text-sm font-semibold tabular-nums text-primary-strong">{formatoCop(valor)}</span> : null}
                  </label>
                  {activa && (
                    <div className="grid gap-4 border-t border-border px-4 pb-4 pt-4 sm:grid-cols-2">
                      <CampoMoneda name={`${P}recursos.${f}.valor`} label={`Valor de ${FUENTES_RECURSOS[f].etiqueta.toLowerCase()}`} />
                      <CampoEntidad name={`${P}recursos.${f}.entidad`} label={`${FUENTES_RECURSOS[f].entidad} (${FUENTES_RECURSOS[f].etiqueta.toLowerCase()})`} tipos={FUENTES_RECURSOS[f].tipos} />
                      {f === "subsidio_familiar" && (
                        <div className="sm:col-span-2">
                          <CampoTexto name={`${P}recursos.${f}.resolucion`} label="Resolución o acta y fecha de expedición" />
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
        <div role="status" className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-muted">Total aportes del hogar</p>
          <p className="text-2xl font-bold tabular-nums text-primary-strong">{formatoCop(total)}</p>
        </div>
      </Grupo>

      {creacion && (
        <>
          <Declaracion />
          <FirmaPostulacion />
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
    <Grupo titulo={DECLARACION_TITULO} columnas={false}>
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
    </Grupo>
  );
}
