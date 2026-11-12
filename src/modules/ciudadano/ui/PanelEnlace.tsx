"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/Button";

/** Admin switch of the citizen link (effective on the next citizen request) + the link to share. */
export function PanelEnlace({ inicial, habilitados, registrados }: { inicial: boolean; habilitados: number; registrados: number }) {
  const [habilitado, setHabilitado] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const enlace = typeof window === "undefined" ? "/ciudadano" : `${window.location.origin}/ciudadano`;

  async function cambiar(valor: boolean) {
    setOcupado(true);
    setError("");
    try {
      const res = await fetch("/api/ciudadano/enlace", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ habilitado: valor }) });
      if (!res.ok) throw new Error();
      setHabilitado(valor);
    } catch {
      setError("No se pudo cambiar el estado del enlace. Intente de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        Estado del enlace:{" "}
        <strong className={habilitado ? "text-success" : "text-danger"}>{habilitado ? "Habilitado" : "Deshabilitado"}</strong>
      </p>
      <p className="text-sm text-muted">
        Ciudadanos habilitados en la lista: {habilitados}. Con registro enviado: {registrados}.
      </p>
      <p>
        Enlace para compartir: <code className="break-all rounded bg-bg px-1">{enlace}</code>
      </p>
      <div>
        <Button variant={habilitado ? "danger" : "primary"} disabled={ocupado} onClick={() => cambiar(!habilitado)}>
          {habilitado ? "Deshabilitar enlace" : "Habilitar enlace"}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
