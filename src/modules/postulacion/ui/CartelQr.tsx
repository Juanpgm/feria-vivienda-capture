"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/Button";

/** Printable poster with the QR of the public form (S14). Built in the browser, so it always points at this deployment. */
export function CartelQr() {
  const [svg, setSvg] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/postulacion`;
    // High error correction: the printed code survives stains and folds.
    QRCode.toString(u, { type: "svg", errorCorrectionLevel: "H", margin: 2 })
      .then((s) => {
        setUrl(u);
        setSvg(s);
      })
      .catch(() => setUrl(u));
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="print:hidden">
        <Button onClick={() => window.print()}>Imprimir</Button>
      </div>
      <article className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border-4 border-primary bg-white p-8 text-center text-black print:border-2">
        <p className="text-sm font-semibold uppercase tracking-wide">Alcaldía de Santiago de Cali · Secretaría de Vivienda Social y Hábitat</p>
        <h1 className="text-3xl font-bold">Postúlese al Subsidio Distrital de Vivienda</h1>
        <p className="text-lg">Escanee el código con la cámara de su celular y diligencie el formulario.</p>
        {svg ? (
          <div role="img" aria-label={`Código QR que abre ${url}`} className="w-72 max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <p role="status">Generando código…</p>
        )}
        <p className="break-all font-mono text-base">{url}</p>
        <p className="text-sm">Tenga a mano su documento de identidad: le pediremos foto del frente y del reverso. El formulario es gratuito.</p>
      </article>
    </div>
  );
}
