"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { calcularEdad } from "@/modules/composicion/domain/derivaciones";
import { ESTADOS_CIVILES, TIPOS_DOCUMENTO } from "@/shared/constantes";
import { normalizarDocumento, normalizarNombre } from "@/shared/normalizacion/texto";
import { fechaBogota } from "@/shared/tiempo";
import { esFechaIso } from "@/shared/validacion";
import type { OpcionBusqueda } from "@/shared/busqueda";
import { Combobox } from "@/shared/ui/Combobox";
import { Field } from "@/shared/ui/Field";
import { RadioGroup } from "@/shared/ui/Radio";
import { regionPorDefecto } from "@/shared/normalizacion/telefono";
import { CampoFecha } from "@/modules/registro/ui/CampoFecha";
import { CampoTelefono } from "@/modules/registro/ui/CampoTelefono";
import { AvisoDuplicado } from "@/modules/registro/ui/AvisoDuplicado";
import { CampoTexto, Seccion, useError } from "@/modules/registro/ui/campos";
import { useModo } from "@/modules/registro/ui/modo";

const P = "solicitante.";
const opciones = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

export function PasoHogar() {
  const { register, setValue, control } = useFormContext<FieldValues>();
  const error = useError();
  const { ciudadano } = useModo();
  const [paises, setPaises] = useState<OpcionBusqueda[]>([]);
  // Set when the funcionario leaves the document number: triggers the (non-blocking) duplicate check.
  const [consulta, setConsulta] = useState<{ tipo?: string; numero: string } | null>(null);
  const numero = useWatch({ control, name: P + "numero_documento" }) as string | undefined;
  const tipo = useWatch({ control, name: P + "tipo_documento" });
  const [nombre1, nombre2, apellido1, apellido2] = useWatch({ control, name: [P + "primer_nombre", P + "segundo_nombre", P + "primer_apellido", P + "segundo_apellido"] }) as string[];
  const nacimiento = useWatch({ control, name: P + "fecha_nacimiento" }) as string | undefined;
  const nacionalidad = useWatch({ control, name: P + "codigo_pais_nacionalidad" }) as string | undefined;
  const hoy = fechaBogota();
  const ayer = new Date(Date.parse(hoy) - 864e5).toISOString().slice(0, 10);
  const regionTelefono = regionPorDefecto(tipo, nacionalidad);

  useEffect(() => {
    import("../catalogo/nacionalidades.json").then((m) =>
      setPaises(m.default.map((n) => ({ value: n.codigo, label: n.nombre, keywords: n.pais }))),
    );
  }, []);

  const tipoReg = register(P + "tipo_documento");
  const edad = nacimiento && esFechaIso(nacimiento) && nacimiento < hoy ? calcularEdad(nacimiento, hoy) : null;

  return (
    <div className="flex flex-col gap-8">
      {ciudadano ? (
        // Name and document come from the eligibility list: shown, never asked.
        <p className="rounded-lg border border-border bg-surface p-3">
          <span className="block text-sm text-muted">Registro a nombre de</span>
          <span className="font-semibold">{[nombre1, nombre2, apellido1, apellido2].filter(Boolean).join(" ")}</span>
          <span className="block text-sm text-muted">Documento {numero}</span>
        </p>
      ) : (
        <Seccion titulo="Nombre">
          <CampoTexto name={P + "primer_nombre"} label="Primer nombre" autoComplete="off" normalizar={normalizarNombre} />
          <CampoTexto name={P + "segundo_nombre"} label="Segundo nombre (opcional)" autoComplete="off" normalizar={normalizarNombre} />
          <CampoTexto name={P + "primer_apellido"} label="Primer apellido" autoComplete="off" normalizar={normalizarNombre} />
          <CampoTexto name={P + "segundo_apellido"} label="Segundo apellido (opcional)" autoComplete="off" normalizar={normalizarNombre} />
        </Seccion>
      )}

      <Seccion titulo="Su documento">
        <div className="sm:col-span-2">
          <RadioGroup
            legend="Tipo de documento"
            name={P + "tipo_documento"}
            options={opciones(TIPOS_DOCUMENTO)}
            error={error(P + "tipo_documento")}
            inputProps={{
              ...tipoReg,
              onChange: (e) => {
                tipoReg.onChange(e);
                if (e.target.value === "cc") setValue(P + "codigo_pais_nacionalidad", "CO", { shouldValidate: true });
              },
            }}
          />
        </div>
        {tipo === "otro" && <CampoTexto name={P + "tipo_documento_otro"} label="Cuál documento" />}
        <Controller
          control={control}
          name={P + "codigo_pais_nacionalidad"}
          render={({ field }) => (
            <Field
              label="Nacionalidad"
              hint={tipo === "cc" ? "Con cédula de ciudadanía es Colombiana" : "Escriba para buscar"}
              error={error(P + "codigo_pais_nacionalidad")}
            >
              {(a11y) => (
                <Combobox {...a11y} options={paises} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} disabled={tipo === "cc"} />
              )}
            </Field>
          )}
        />
        {!ciudadano && (
          <CampoTexto
            name={P + "numero_documento"}
            label="Número de documento"
            inputMode="text"
            autoComplete="off"
            normalizar={normalizarDocumento}
            alSalir={(v) => setConsulta(v ? { tipo, numero: v } : null)}
          />
        )}
        <CampoFecha name={P + "fecha_expedicion_documento"} label="Fecha de expedición" max={hoy} mensajeMax="La fecha de expedición no puede ser futura" />
        {!ciudadano && <AvisoDuplicado consulta={consulta} actual={normalizarDocumento(numero ?? "")} />}
      </Seccion>

      <Seccion titulo="Cómo contactarlo">
        <CampoTelefono name={P + "telefono_1"} label="Teléfono principal" etiquetaPais="Código de país del teléfono principal" regionInicial={regionTelefono} conEjemplo />
        <CampoTelefono name={P + "telefono_2"} label="Teléfono alterno (opcional)" etiquetaPais="Código de país del teléfono alterno" regionInicial={regionTelefono} />
        <div className="sm:col-span-2">
          <CampoTexto
            name={P + "correo_solicitante"}
            label="Correo electrónico"
            type="email"
            autoComplete="off"
            normalizar={(v) => v.trim().toLowerCase()}
          />
        </div>
      </Seccion>

      <Seccion titulo="Sobre usted">
        <CampoFecha
          name={P + "fecha_nacimiento"}
          label="Fecha de nacimiento"
          max={ayer}
          mensajeMax="La fecha de nacimiento debe ser anterior a hoy"
          hint={edad !== null ? `Edad: ${edad} años` : undefined}
        />
        <div className="sm:col-span-2">
          <RadioGroup legend="Estado civil" name={P + "estado_civil"} options={opciones(ESTADOS_CIVILES)} error={error(P + "estado_civil")} inputProps={register(P + "estado_civil")} />
        </div>
        <CampoTexto
          name={P + "anios_residencia"}
          label="Años de residencia"
          inputMode="decimal"
          hint="Puede usar decimales, por ejemplo 2,5"
          normalizar={(v) => v.trim().replace(",", ".")}
        />
      </Seccion>
    </div>
  );
}
