"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PadFirma } from "@/modules/firma/ui/PadFirma";
import { Button } from "@/shared/ui/Button";
import { Field, TextInput } from "@/shared/ui/Field";
import { AVISO_VALIDACION, CONFIRMACION_PAQUETE } from "../domain/texto";

/**
 * "Validar registro" (S13): warning of responsibility, confirmation of the complete document package, folios and the
 * official's signature. Disabled while mandatory data is missing (the server refuses it too).
 */
export function BotonValidar({ id, radicado, faltantes }: { id: string; radicado: string; faltantes: number }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [responsable, setResponsable] = useState(false);
  const [paquete, setPaquete] = useState(false);
  const [folios, setFolios] = useState("");
  const [firma, setFirma] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listo = responsable && paquete && !!firma && !enviando;

  async function validar() {
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/postulaciones/${id}/validar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acepta_responsabilidad: responsable, confirmacion_paquete_completo: paquete, folios_anexos: folios, firma }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ?? "No se pudo validar. Intente de nuevo.");
      dialogo.current?.close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (faltantes > 0)
    return (
      <div className="flex flex-col items-start gap-2">
        <Button disabled>Validar registro</Button>
        <p className="text-sm text-muted">No se puede validar: complete primero los datos obligatorios que faltan.</p>
      </div>
    );

  return (
    <>
      <div>
        <Button onClick={() => dialogo.current?.showModal()}>Validar registro</Button>
      </div>
      <dialog ref={dialogo} aria-labelledby="validar-titulo" className="m-auto w-[min(40rem,calc(100%-2rem))] rounded-xl border border-border bg-bg p-6 text-text backdrop:bg-black/50">
        <h2 id="validar-titulo" className="text-xl font-bold text-primary-strong">Validar la postulación {radicado}</h2>
        <p role="note" className="mt-3 rounded-lg bg-warning-bg p-3 font-medium text-warning-text">{AVISO_VALIDACION}</p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 size-5" checked={paquete} onChange={(e) => setPaquete(e.target.checked)} />
            <span className="font-medium">{CONFIRMACION_PAQUETE}</span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 size-5" checked={responsable} onChange={(e) => setResponsable(e.target.checked)} />
            <span className="font-medium">Me hago responsable de la información validada</span>
          </label>
          <div className="max-w-48">
            <Field label="No. de folios anexos (opcional)">
              {(a11y) => <TextInput {...a11y} inputMode="numeric" value={folios} onChange={(e) => setFolios(e.target.value.replace(/\D/g, "").slice(0, 3))} />}
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Firma del funcionario</p>
            {firma ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={firma} alt="Su firma" className="h-24 w-48 rounded-lg border border-border bg-white object-contain" />
                <Button variant="secondary" onClick={() => setFirma("")}>Firmar de nuevo</Button>
              </div>
            ) : (
              <PadFirma onConfirmar={setFirma} />
            )}
          </div>
          {error && <p role="alert" className="font-medium text-danger">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={validar} disabled={!listo}>{enviando ? "Validando…" : "Confirmar validación"}</Button>
            <Button variant="secondary" disabled={enviando} onClick={() => dialogo.current?.close()}>Cancelar</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
