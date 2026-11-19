"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/shared/ui/Button";

/** Admin switch of the public postulación form (S17), same behavior as the citizen link switch. */
export function PanelFormulario({ inicial }: { inicial: boolean }) {
  const [habilitado, setHabilitado] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

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
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
