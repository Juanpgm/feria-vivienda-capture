"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { Field, TextArea } from "@/shared/ui/Field";

/** Admin/superadmin: deletes a postulación for good after a reason and an explicit confirmation (audited server-side). */
export function BotonBorrar({ id, radicado, nombre, despues = "refrescar", compacto = false }: { id: string; radicado: string; nombre: string; despues?: "refrescar" | "listado"; compacto?: boolean }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [motivo, setMotivo] = useState("");
  const [seguro, setSeguro] = useState(false);
  const [error, setError] = useState("");
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    setBorrando(true);
    setError("");
    try {
      const res = await fetch(`/api/postulaciones/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.campos?.motivo?.[0] ?? j?.error ?? "No se pudo borrar. Intente de nuevo.");
      dialogo.current?.close();
      if (despues === "listado") router.push("/postulaciones");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <Button variant="danger" className={compacto ? "min-h-9 px-3 text-sm" : ""} onClick={() => dialogo.current?.showModal()} aria-label={`Borrar la postulación ${radicado}`}>
        Borrar
      </Button>
      <dialog ref={dialogo} aria-labelledby={`borrar-${id}`} className="m-auto w-[min(34rem,calc(100%-2rem))] rounded-xl border border-border bg-bg p-6 text-left text-text backdrop:bg-black/50">
        <h2 id={`borrar-${id}`} className="text-xl font-bold text-danger">Borrar la postulación {radicado}</h2>
        <p className="mt-2">
          Se borrarán para siempre los datos de <strong>{nombre}</strong>, las fotos del documento, la firma, el historial y su validación si la tiene. No se
          puede deshacer. El número {radicado} no se vuelve a usar y queda constancia del borrado a su nombre.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Motivo del borrado" hint="Obligatorio, mínimo 10 caracteres. Por ejemplo: registro duplicado o de prueba." error={error || undefined}>
            {(a11y) => <TextArea {...a11y} rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Field>
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 size-5" checked={seguro} onChange={(e) => setSeguro(e.target.checked)} />
            <span className="font-medium">Entiendo que el borrado es definitivo</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button variant="danger" disabled={!seguro || motivo.trim().length < 10 || borrando} onClick={borrar}>
              {borrando ? "Borrando…" : "Borrar definitivamente"}
            </Button>
            <Button variant="secondary" disabled={borrando} onClick={() => dialogo.current?.close()}>
              Cancelar
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
