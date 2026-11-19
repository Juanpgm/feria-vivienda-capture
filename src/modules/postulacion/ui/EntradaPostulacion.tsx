"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { normalizarDocumento } from "@/shared/normalizacion/texto";
import { Button } from "@/shared/ui/Button";
import { Field, TextInput } from "@/shared/ui/Field";
import { Select } from "@/shared/ui/Select";
import { ESTADOS_POSTULACION, TIPOS_DOCUMENTO_SOLICITANTE, opciones, type EstadoPostulacion } from "../domain/catalogos";
import { FormularioPostulacion } from "./FormularioPostulacion";

type Existente = { radicado: string; estado: EstadoPostulacion; id?: string };

/**
 * S12: the first thing asked is the identity document, in a modal. An existing postulación can only be looked at
 * (the public sees its radicado and status; staff get the link to the record); otherwise the form opens for it.
 */
export function EntradaPostulacion({ uid, publico }: { uid: string; publico: boolean }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [tipo, setTipo] = useState("cc");
  const [numero, setNumero] = useState("");
  const [error, setError] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [existente, setExistente] = useState<Existente | null>(null);
  const [nuevo, setNuevo] = useState<string | null>(null);

  useEffect(() => {
    if (!nuevo) dialogo.current?.showModal();
  }, [nuevo]);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    const documento = normalizarDocumento(numero);
    if (!/^[A-Z0-9]{4,20}$/.test(documento)) return setError("Escriba el número de documento, solo números (sin puntos ni espacios).");
    setConsultando(true);
    setError("");
    try {
      const res = await fetch("/api/postulaciones/consulta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documento }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setError(j?.error ?? "No se pudo consultar. Intente de nuevo.");
      if (j.existe) return setExistente({ radicado: j.radicado, estado: j.estado, id: j.id });
      dialogo.current?.close();
      setNuevo(documento);
    } catch {
      setError("No hay conexión. Revise su internet e intente de nuevo.");
    } finally {
      setConsultando(false);
    }
  }

  if (nuevo) return <FormularioPostulacion uid={uid} documento={nuevo} tipoDocumento={tipo} publico={publico} />;

  return (
    <>

      {/* Escape must not leave the page without a document: the dialog is the entry point. */}
      <dialog
        ref={dialogo}
        aria-labelledby="entrada-titulo"
        onCancel={(e) => e.preventDefault()}
        className="m-auto w-[min(34rem,calc(100%-2rem))] overflow-hidden rounded-xl border border-border bg-bg p-0 text-text shadow-[0_24px_60px_-20px_rgb(0_54_95/0.6)] backdrop:bg-primary-strong/60 backdrop:backdrop-blur-sm"
      >
        <div className="relative bg-[#00365f] px-6 pb-5 pt-5 text-white">
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
          <p className="text-sm text-white/80">Subsidio Distrital de Vivienda</p>
          <h2 id="entrada-titulo" className="mt-1 text-2xl font-bold">
            {existente ? "Ya existe una postulación" : "Nueva postulación"}
          </h2>
        </div>
        <div className="p-6">
        {existente ? (
          <div className="mt-4 flex flex-col gap-4">
            <p>Este documento ya tiene una postulación registrada. No se puede crear otra.</p>
            <dl className="grid grid-cols-[8rem_1fr] gap-1">
              <dt className="text-sm text-muted">Radicado</dt>
              <dd data-testid="radicado-existente" className="font-bold tabular-nums">{existente.radicado}</dd>
              <dt className="text-sm text-muted">Estado</dt>
              <dd className="font-bold">{ESTADOS_POSTULACION[existente.estado]}</dd>
            </dl>
            {publico ? (
              <p className="text-sm text-muted">Si necesita corregir algún dato, acérquese a la Secretaría de Vivienda Social y Hábitat con su documento.</p>
            ) : (
              existente.id && (
                <Link href={`/postulaciones/${existente.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
                  Ver la postulación
                </Link>
              )
            )}
            <div>
              <Button variant="secondary" onClick={() => { setExistente(null); setNumero(""); }}>
                Consultar otro documento
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={consultar} noValidate className="mt-4 flex flex-col gap-4">
            <p>Empiece con el documento de quien se postula como jefe del hogar. Revisamos que no tenga ya una postulación.</p>
            <div className="rounded-lg bg-surface p-4 text-sm">
              <p className="font-semibold">Tenga a mano</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                <li className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span>Su documento de identidad: le pediremos foto del frente y del reverso.</li>
                <li className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span>Nombres, documentos e ingresos de las personas de su hogar.</li>
                <li className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span>Los valores de ahorros, cesantías o créditos con que cuente.</li>
              </ul>
              <p className="mt-3 text-muted">Toma unos 12 minutos. Lo que escriba se guarda en este equipo, así que puede retomarlo.</p>
            </div>
            <Field label="Tipo de documento del solicitante">
              {(a11y) => <Select {...a11y} value={tipo} onChange={(e) => setTipo(e.target.value)} options={opciones(TIPOS_DOCUMENTO_SOLICITANTE)} placeholder="Seleccione…" />}
            </Field>
            <Field label="Número de documento" error={error || undefined}>
              {(a11y) => <TextInput {...a11y} autoFocus inputMode="numeric" autoComplete="off" value={numero} onChange={(e) => setNumero(e.target.value)} />}
            </Field>
            <div>
              <Button type="submit" disabled={consultando || !tipo}>
                {consultando ? "Revisando…" : "Continuar"}
              </Button>
            </div>
          </form>
        )}
        </div>
      </dialog>
    </>
  );
}
