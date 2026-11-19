"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/shared/ui/Button";

/** Admin switch of the public postulación form (S17), same behavior as the citizen link switch. */
export function PanelFormulario({ inicial }: { inicial: boolean }) {
  const [habilitado, setHabilitado] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [confirmarAnular, setConfirmarAnular] = useState(false);
  const [anulado, setAnulado] = useState(false);

  async function anular() {
    setOcupado(true);
    setError("");
    try {
      const res = await fetch("/api/postulaciones/qr/anular", { method: "POST" });
      if (!res.ok) throw new Error();
      setAnulado(true);
      setConfirmarAnular(false);
    } catch {
      setError("No se pudieron anular los códigos. Intente de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  async function cambiar(valor: boolean) {
    setOcupado(true);
    setError("");
    try {
      const res = await fetch("/api/postulaciones/formulario", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ habilitado: valor }) });
      if (!res.ok) throw new Error();
      setHabilitado(valor);
    } catch {
      setError("No se pudo cambiar el estado del formulario. Intente de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        Formulario público:{" "}
        <strong className={habilitado ? "text-success" : "text-danger"}>{habilitado ? "Habilitado" : "Deshabilitado"}</strong>
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant={habilitado ? "danger" : "primary"} disabled={ocupado} onClick={() => cambiar(!habilitado)}>
          {habilitado ? "Deshabilitar formulario" : "Habilitar formulario"}
        </Button>
        <Link href="/postulaciones/qr" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold">
          Descargar QR en PDF
        </Link>
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="font-semibold">Códigos QR impresos</p>
        <p className="text-sm text-muted">Si un cartel se perdió o una foto de él circula, anule todos los códigos emitidos. Los carteles actuales dejan de funcionar y hay que descargar e imprimir uno nuevo.</p>
        {anulado && <p role="status" className="text-sm font-semibold text-success">Códigos anulados. Descargue e imprima un cartel nuevo.</p>}
        {confirmarAnular ? (
          <div role="group" aria-label="Confirmar anulación" className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">¿Anular todos los códigos QR emitidos?</span>
            <Button variant="danger" disabled={ocupado} onClick={anular}>Sí, anular</Button>
            <Button variant="secondary" disabled={ocupado} onClick={() => setConfirmarAnular(false)}>Cancelar</Button>
          </div>
        ) : (
          <div>
            <Button variant="secondary" disabled={ocupado} onClick={() => setConfirmarAnular(true)}>Anular códigos QR emitidos</Button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
