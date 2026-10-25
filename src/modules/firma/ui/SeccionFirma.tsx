"use client";

import { useEffect, useState } from "react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { useError } from "@/modules/registro/ui/campos";
import { Field, TextArea } from "@/shared/ui/Field";
import { Button } from "@/shared/ui/Button";
import { Select } from "@/shared/ui/Select";
import { FIRMA_VACIA, firmaVigente, METODOS_VERIFICACION, NOTA_MIN, selloDeDatos } from "../domain/schema";
import { PadFirma } from "./PadFirma";

const P = "firma.";
const OPCIONES = Object.entries(METODOS_VERIFICACION).map(([value, label]) => ({ value, label }));

/**
 * The applicant's signature: drawn on screen, or a manual verification when drawing is not possible.
 * A stored signature carries a seal of the data it was signed over; when the data changes afterwards the signature is
 * dropped here and must be redone (REQ-SIG-1). The drawn image is only previewed in this step.
 */
export function SeccionFirma() {
  const { register, setValue, getValues, control, trigger } = useFormContext<FieldValues>();
  const error = useError();
  const valores = useWatch({ control }) as Record<string, Record<string, unknown>>;
  const firma = valores.firma ?? {};
  // Signed = method AND seal: while the manual form is being filled the method is set but there is no seal yet.
  const registrada = !!firma.metodo_firma && !!firma.sello;
  const vigente = registrada && firmaVigente(valores);
  const [modo, setModo] = useState<"dibujada" | "verificacion_manual">(firma.metodo_firma === "verificacion_manual" ? "verificacion_manual" : "dibujada");
  const obsoleta = firma.obsoleta === true; // set when the data changed after signing; cleared by the next signature

  // Data edited after signing: the signature no longer covers what is on screen.
  useEffect(() => {
    if (registrada && !vigente) {
      setValue(P.slice(0, -1), { ...FIRMA_VACIA, obsoleta: true }, { shouldDirty: true });
    }
  }, [registrada, vigente, setValue]);

  const limpiar = () => setValue(P.slice(0, -1), { ...FIRMA_VACIA }, { shouldDirty: true });
  const elegirModo = (m: typeof modo) => {
    if (m === modo) return;
    limpiar();
    setModo(m);
  };

  function guardarDibujada(url: string) {
    setValue(P.slice(0, -1), { ...FIRMA_VACIA, metodo_firma: "dibujada", imagen: url, sello: selloDeDatos(getValues()) }, { shouldDirty: true });
  }
  async function guardarManual() {
    setValue(P + "metodo_firma", "verificacion_manual");
    setValue(P + "imagen", "");
    if (await trigger()) {
      setValue(P + "obsoleta", false);
      setValue(P + "sello", selloDeDatos(getValues()), { shouldDirty: true });
    }
  }

  return (
    <section aria-labelledby="firma-titulo" className="flex flex-col gap-4">
      <h3 id="firma-titulo" className="border-b border-border pb-1 text-lg font-bold text-primary-strong">
        Firma del solicitante
      </h3>
      {obsoleta && (
        <p role="alert" className="rounded-lg bg-warning-bg p-3 font-medium text-warning-text">
          Los datos del registro cambiaron después de firmar, por eso la firma se borró. El solicitante debe firmar de nuevo.
        </p>
      )}

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">¿Cómo firma el solicitante?</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="radio" className="radio" name="modo-firma" checked={modo === "dibujada"} onChange={() => elegirModo("dibujada")} />
          Firma en esta pantalla
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="radio" className="radio" name="modo-firma" checked={modo === "verificacion_manual"} onChange={() => elegirModo("verificacion_manual")} />
          No es posible firmar en pantalla (verificación manual)
        </label>
      </fieldset>

      {modo === "dibujada" ? (
        vigente ? (
          <div className="flex flex-col items-start gap-3">
            <p role="status" className="font-semibold text-success">
              Firma registrada.
            </p>
            {/* In-session preview for the person who just signed; the image is not shown anywhere else outside the admin detail. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={String(firma.imagen)} alt="Firma dibujada por el solicitante" className="h-28 w-56 rounded-lg border border-border bg-white object-contain" />
            <Button variant="secondary" onClick={limpiar}>
              Firmar de nuevo
            </Button>
          </div>
        ) : (
          <PadFirma onConfirmar={guardarDibujada} />
        )
      ) : vigente ? (
        <div className="flex flex-col items-start gap-2">
          <p role="status" className="font-semibold text-success">
            Verificación manual registrada.
          </p>
          <p>
            {METODOS_VERIFICACION[firma.metodo_verificacion as keyof typeof METODOS_VERIFICACION]}: {String(firma.nota_verificacion)}
          </p>
          <Button variant="secondary" onClick={limpiar}>
            Cambiar la verificación
          </Button>
        </div>
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          <p className="text-sm text-muted">
            Use esta opción solo si el solicitante no puede firmar en pantalla. Queda registrada a nombre del funcionario que envía el registro, con la fecha y hora del servidor.
          </p>
          <Field label="Método de verificación" error={error(P + "metodo_verificacion")}>
            {(a11y) => <Select {...a11y} options={OPCIONES} {...register(P + "metodo_verificacion")} />}
          </Field>
          <Field label="Nota de la verificación" hint={`Obligatoria, mínimo ${NOTA_MIN} caracteres. Por ejemplo, dónde quedó la firma en papel.`} error={error(P + "nota_verificacion")}>
            {(a11y) => <TextArea {...a11y} rows={3} maxLength={500} {...register(P + "nota_verificacion")} />}
          </Field>
          <div>
            <Button onClick={guardarManual}>Registrar verificación manual</Button>
          </div>
        </div>
      )}
    </section>
  );
}
