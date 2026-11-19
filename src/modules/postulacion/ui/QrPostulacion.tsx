"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * QR of one postulación (/postulacion/estado/{id}): the citizen sees its status; a logged-in official opens the record.
 * Built in the browser so it always points at this deployment; it can be saved as an image.
 */
export function QrPostulacion({ id, radicado }: { id: string; radicado: string }) {
  const [svg, setSvg] = useState("");
  const [png, setPng] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/postulacion/estado/${id}`;
    Promise.all([
      QRCode.toString(u, { type: "svg", errorCorrectionLevel: "M", margin: 1 }),
      QRCode.toDataURL(u, { errorCorrectionLevel: "M", margin: 2, width: 600 }),
    ])
      .then(([s, p]) => {
        setSvg(s);
        setPng(p);
      })
      .catch(() => undefined);
  }, [id]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-4 text-center sm:flex-row sm:text-left">
      {svg ? (
        <div role="img" aria-label={`Código QR de la postulación ${radicado}`} data-testid="qr-postulacion" className="size-36 shrink-0 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <p role="status" className="size-36 shrink-0">Generando código…</p>
      )}
      <div className="flex flex-col gap-2">
        <p className="font-semibold">Código QR de su postulación</p>
        <p className="text-sm text-muted">Escanéelo para consultar el estado en cualquier momento. Guárdelo junto con su número de registro.</p>
        {png && (
          <a href={png} download={`postulacion-${radicado}.png`} className="inline-flex min-h-11 items-center self-center rounded-lg border border-border bg-bg px-4 font-semibold hover:bg-surface sm:self-start">
            Guardar código QR
          </a>
        )}
      </div>
    </div>
  );
}
