"use client";

import { useWatch } from "react-hook-form";
import { TIPOS_FOTO } from "@/modules/documentos/domain/imagen";
import { FOTO_CAPTURADA } from "@/modules/documentos/domain/schema";
import { FotoCaptura } from "@/modules/documentos/ui/FotoCaptura";
import { PasoInmueble, type UbicacionGeocodificada } from "@/modules/inmueble/ui/PasoInmueble";
import { CampoFecha } from "@/modules/registro/ui/CampoFecha";
import { CampoTelefono } from "@/modules/registro/ui/CampoTelefono";
import { CampoTexto, Seccion, useError } from "@/modules/registro/ui/campos";
import { normalizarNombre } from "@/shared/normalizacion/texto";
import { fechaBogota } from "@/shared/tiempo";
import {
  CONDICIONES_ESPECIALES, GENEROS_SOLICITANTE, GRUPOS_SISBEN, OCUPACIONES_SOLICITANTE, SUBGRUPO_MAX, TIPOS_DOCUMENTO_SOLICITANTE, opciones,
} from "../domain/catalogos";
import { NOTIFICACION_ELECTRONICA } from "../domain/texto";
import { CampoMoneda, CampoMultiple, CampoMunicipio, CampoSelect, CampoSiNo } from "./campos";

const P = "solicitante.";
const nombre = (v: string) => (v.trim() ? normalizarNombre(v) : null);
/** Geocoder of the Alcaldía through our API (null when it cannot locate the address or is unavailable). */
async function ubicar(direccion: string): Promise<UbicacionGeocodificada | null> {
  const r = await fetch("/api/postulaciones/ubicar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direccion }) });
  return r.ok ? ((await r.json()).ubicacion ?? null) : null;
}
const SUBGRUPOS = Array.from({ length: SUBGRUPO_MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

/** Step 1: section 1 of the format (jefe del hogar) + photos of the identity document (S16). */
export function PasoSolicitante({ borradorId, documentoFijo }: { borradorId: string; documentoFijo: boolean }) {
  const error = useError();
  const [genero, ocupacion, caja, sisben, nacimiento] = useWatch({ name: [P + "genero", P + "ocupacion", P + "caja_compensacion", P + "sisben", P + "lugar_nacimiento"] }) as string[];
  const frente = useWatch({ name: "documentos.documento_frente" }) === FOTO_CAPTURADA;

  return (
    <div className="flex flex-col gap-10">
      <Seccion titulo="Identificación">
        <CampoTexto name={P + "nombres"} label="Nombres" autoComplete="given-name" normalizar={nombre} />
        <CampoTexto name={P + "apellidos"} label="Apellidos" autoComplete="family-name" normalizar={nombre} />
        <CampoSelect name={P + "tipo_documento"} label="Tipo de documento del solicitante" options={opciones(TIPOS_DOCUMENTO_SOLICITANTE)} />
        <CampoTexto name={P + "numero_documento"} label="Número de documento" readOnly={documentoFijo} hint={documentoFijo ? "Es el documento con el que inició la postulación." : undefined} />
        <CampoMunicipio name={P + "lugar_expedicion"} label="Lugar de expedición" />
        <CampoFecha name={P + "fecha_expedicion"} label="Fecha de expedición" max={fechaBogota()} mensajeMax="La fecha de expedición no puede ser futura" />
        <CampoFecha name={P + "fecha_nacimiento"} label="Fecha de nacimiento" max={fechaBogota()} mensajeMax="La fecha de nacimiento debe ser anterior a hoy" />
        <CampoMunicipio name={P + "lugar_nacimiento"} label="Lugar de nacimiento" exterior />
        {nacimiento === "exterior" && <CampoTexto name={P + "lugar_nacimiento_otro"} label="País y ciudad de nacimiento" normalizar={nombre} />}
        <CampoSelect name={P + "genero"} label="Género" options={opciones(GENEROS_SOLICITANTE)} />
        {genero === "otro" && <CampoTexto name={P + "genero_otro"} label="¿Cuál género?" />}
      </Seccion>

      <Seccion titulo="Contacto">
        <CampoTelefono name={P + "telefono"} label="Teléfono o celular" etiquetaPais="Código de país del teléfono" regionInicial="CO" />
        <CampoTexto name={P + "correo"} label="Correo electrónico" type="email" autoComplete="email" inputMode="email" />
        <div className="sm:col-span-2">
          <CampoSiNo name={P + "notificacion_electronica"} legend={NOTIFICACION_ELECTRONICA} />
        </div>
      </Seccion>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Domicilio actual</h3>
        <p className="text-sm text-muted">
          Escriba la dirección como la conoce: la convertimos al formato catastral y con ella buscamos la comuna y el barrio (puede cambiarlos). El estrato sale del barrio.
        </p>
        <PasoInmueble prefijo={P} etiquetaDireccion="Dirección de domicilio actual" ubicar={ubicar} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto name={P + "anios_residencia"} label="Tiempo de residencia en Cali (años)" inputMode="numeric" />
        </div>
      </section>

      <Seccion titulo="Trabajo e ingresos">
        <CampoSelect name={P + "ocupacion"} label="Ocupación" options={opciones(OCUPACIONES_SOLICITANTE)} />
        <CampoMoneda name={P + "ingreso_mensual"} label="Ingreso mensual del solicitante" />
        {ocupacion === "empleado" && (
          <>
            <CampoTexto name={P + "empresa"} label="Empresa donde labora" />
            <CampoTelefono name={P + "telefono_empresa"} label="Teléfono de la empresa (opcional)" etiquetaPais="Código de país del teléfono de la empresa" regionInicial="CO" />
          </>
        )}
      </Seccion>

      <Seccion titulo="Afiliaciones">
        <CampoSiNo name={P + "caja_compensacion"} legend="¿Está afiliado a una caja de compensación?" />
        {caja === "si" ? <CampoTexto name={P + "caja_cual"} label="¿Cuál caja de compensación?" /> : <span />}
        <CampoSiNo name={P + "sisben"} legend="¿Está afiliado al Sisbén?" />
        {sisben === "si" ? (
          <div className="grid grid-cols-2 gap-3">
            <CampoSelect name={P + "sisben_grupo"} label="Grupo Sisbén IV" options={opciones(GRUPOS_SISBEN)} />
            <CampoSelect name={P + "sisben_subgrupo"} label="Subgrupo Sisbén IV" options={SUBGRUPOS} />
          </div>
        ) : <span />}
        <div className="sm:col-span-2">
          <CampoMultiple name={P + "condiciones_especiales"} label="Condición especial del solicitante" options={opciones(CONDICIONES_ESPECIALES)} exclusiva="ninguna" />
        </div>
      </Seccion>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Fotos del documento de identidad</h3>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="font-semibold">Sin las dos fotos no se puede registrar la postulación.</p>
          <p className="mt-1 text-sm text-muted">
            Primero la parte de adelante (donde sale la foto) y después la de atrás. Con buena luz, sin reflejos y el documento completo dentro del marco.
            Solo el personal autorizado de la Secretaría puede verlas.
          </p>
        </div>
        {TIPOS_FOTO.map((tipo) => (
          <FotoCaptura
            key={tipo}
            borradorId={borradorId}
            tipo={tipo}
            errorFormulario={error(`documentos.${tipo}`)}
            bloqueada={tipo === "documento_reverso" && !frente ? "Primero tome la foto de la parte de adelante." : undefined}
          />
        ))}
      </section>
    </div>
  );
}
