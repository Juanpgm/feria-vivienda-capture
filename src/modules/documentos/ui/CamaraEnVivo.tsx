"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";

const MENSAJES: Record<string, string> = {
  NotAllowedError: "No se pudo usar la cámara porque el permiso fue denegado. Permita el acceso en el navegador o elija un archivo.",
  NotFoundError: "No se encontró una cámara en este equipo. Elija un archivo en su lugar.",
  NotReadableError: "La cámara está siendo usada por otra aplicación. Ciérrela o elija un archivo.",
};

/** Desktop live preview (getUserMedia). Hands the captured frame to `alCapturar` as a JPEG blob. */
export function CamaraEnVivo({ etiqueta, alCapturar, alCerrar }: { etiqueta: string; alCapturar: (b: Blob) => void; alCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let flujo: MediaStream | undefined;
    let activo = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (!activo) return s.getTracks().forEach((t) => t.stop());
        flujo = s;
        if (video.current) video.current.srcObject = s;
        setListo(true);
      })
      .catch((e: Error) => activo && setError(MENSAJES[e.name] ?? "No se pudo abrir la cámara. Elija un archivo en su lugar."));
    return () => {
      activo = false;
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (listo) caja.current?.querySelector("button")?.focus();
  }, [listo]);

  function tomar() {
    const v = video.current;
    if (!v?.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((b) => (b ? alCapturar(b) : setError("No se pudo tomar la foto. Intente de nuevo.")), "image/jpeg", 0.92);
  }

  return (
    <div ref={caja} role="group" aria-label={`Cámara: ${etiqueta}`} onKeyDown={(e) => e.key === "Escape" && alCerrar()} className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : (
        <video ref={video} autoPlay playsInline muted aria-label={`Vista de la cámara para ${etiqueta.toLowerCase()}`} className="w-full max-w-md rounded-lg border border-border bg-surface" />
      )}
      <div className="flex flex-wrap gap-2">
        {!error && (
          <Button disabled={!listo} onClick={tomar}>
            Capturar
          </Button>
        )}
        <Button variant="secondary" onClick={alCerrar}>
          Cerrar cámara
        </Button>
      </div>
    </div>
  );
}
