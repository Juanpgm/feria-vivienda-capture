"use client";

import { getExampleNumber, type CountryCode } from "libphonenumber-js/min";
import ejemplos from "libphonenumber-js/examples.mobile.json";
import { useEffect, useRef, useState } from "react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import { opcionesPaisTelefono } from "@/shared/paisesTelefono";
import { REGION_POR_DEFECTO, esRegion, regionDeValor, resolverTelefono, textoNacional } from "@/shared/normalizacion/telefono";
import { Combobox } from "@/shared/ui/Combobox";
import { Field, controlClass } from "@/shared/ui/Field";
import { useError } from "./campos";

/**
 * Phone with a searchable country-code selector. The form holds one E.164 string in `name` (or `+<code><digits>`
 * while incomplete) and the selected region in `<name>_pais`, so the draft restores both.
 * `regionInicial` is the code a new phone starts with; it follows the nationality while the field is still empty.
 */
export function CampoTelefono({
  name, label, etiquetaPais, regionInicial, conEjemplo = false,
}: { name: string; label: string; etiquetaPais: string; regionInicial: CountryCode; conEjemplo?: boolean }) {
  const { control } = useFormContext<FieldValues>();
  const error = useError()(name);
  const tel = useController({ control, name });
  const pais = useController({ control, name: `${name}_pais` });
  const valor = String(tel.field.value ?? "");
  const guardada = String(pais.field.value ?? "");
  const region = regionDeValor(valor, esRegion(guardada) ? guardada : REGION_POR_DEFECTO);
  const [texto, setTexto] = useState(() => textoNacional(valor, region));

  function aplicar(t: string, r: CountryCode) {
    const res = resolverTelefono(t, r);
    tel.field.onChange(res.valor);
    pais.field.onChange(res.region);
    return res;
  }

  const previa = useRef(regionInicial);
  const { onChange: cambiarPais } = pais.field;
  useEffect(() => {
    if (previa.current === regionInicial) return;
    if (!texto.trim() && region === previa.current) cambiarPais(regionInicial);
    previa.current = regionInicial;
  }, [regionInicial, texto, region, cambiarPais]);

  const ejemplo = region === REGION_POR_DEFECTO ? "300 123 4567" : getExampleNumber(region, ejemplos)?.formatNational();
  return (
    <Field label={label} hint={conEjemplo && ejemplo ? `Ejemplo: ${ejemplo}` : undefined} error={error}>
      {(a11y) => (
        <div className="flex gap-2">
          <div className="w-32 shrink-0">
            <Combobox
              aria-label={etiquetaPais}
              options={opcionesPaisTelefono()}
              value={region}
              limite={300}
              listaClass="w-72 max-w-[calc(100vw-2rem)]"
              onChange={(r) => aplicar(texto, r as CountryCode)}
              onBlur={pais.field.onBlur}
            />
          </div>
          <input
            {...a11y}
            ref={tel.field.ref}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className={controlClass}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              aplicar(e.target.value, region);
            }}
            onBlur={() => {
              const res = aplicar(texto, region);
              setTexto(textoNacional(res.valor, res.region)); // show the national part; the selector carries the code
              tel.field.onBlur();
            }}
          />
        </div>
      )}
    </Field>
  );
}
