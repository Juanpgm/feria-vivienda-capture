"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { DOCUMENTACION, DOCUMENTACION_TITULO } from "../domain/texto";
import { descargarCartel, fechaVence, PASOS_CARTEL } from "./pdfCartel";

/**
 * QR poster of the public form (S14): a preview and a printable PDF with instructions. The QR opens only the
 * registration form; the link is not shown or offered anywhere, only the QR and the document.
 */
export function CartelQr() {
  const [dias, setDias] = useState<1 | 7 | 30>(7);
  const [codigo, setCodigo] = useState<{ destino: string; exp: number } | null>(null);
  const [svg, setSvg] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  // A fresh access code for the chosen validity; the QR (and the PDF) carry it. A photo of the poster stops working when it expires.
  useEffect(() => {
    let vivo = true;
    fetch("/api/postulaciones/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dias }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(async ({ token, exp }: { token: string; exp: number }) => {
        const destino = `${window.location.origin}/postulacion/ingreso?t=${encodeURIComponent(token)}`;
        const s = await QRCode.toString(destino, { type: "svg", errorCorrectionLevel: "H", margin: 1 });
        if (!vivo) return;
        setCodigo({ destino, exp });
        setSvg(s);
        setError("");
      })
      .catch(() => vivo && setError("No se pudo generar el código. Recargue la página."));
    return () => {
      vivo = false;
    };
  }, [dias]);

  async function descargar() {
    if (!codigo) return;
    setGenerando(true);
    setError("");
    try {
      await descargarCartel(codigo.destino, codigo.exp);
    } catch {
      setError("No se pudo generar el PDF. Intente de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-strong">Código QR del formulario de postulación</h1>
          <p className="mt-1 max-w-prose text-muted">
            Descargue el PDF para imprimirlo. Quien escanee el código llega solo al formulario de registro y no puede ver otras postulaciones. El código vence: una foto del cartel deja de funcionar al terminar su vigencia.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Vigencia del código
            <select value={dias} onChange={(e) => setDias(Number(e.target.value) as 1 | 7 | 30)} className="min-h-11 rounded-lg border border-border bg-bg px-3 text-base">
              <option value={1}>Solo hoy</option>
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
            </select>
          </label>
          <Button onClick={descargar} disabled={generando || !svg}>
            {generando ? "Generando PDF…" : "Descargar PDF para imprimir"}
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="font-medium text-danger">{error}</p>}

      {/* Preview of the printed sheet. */}
      <article aria-label="Vista previa del cartel" className="overflow-hidden rounded-xl border border-border bg-white text-[#222221] shadow-[0_18px_40px_-24px_rgb(0_54_95/0.55)]">
        <div className="relative bg-[#00365f] px-8 py-5 text-white">
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
          <p className="text-sm">Alcaldía de Santiago de Cali</p>
          <p className="font-bold">Secretaría de Vivienda Social y Hábitat</p>
        </div>
        <div className="flex flex-col items-center gap-4 px-8 py-8 text-center">
          <h2 className="text-3xl font-bold text-[#00365f]">Postúlese al Subsidio Distrital de Vivienda</h2>
          <p className="text-[#4d4d4d]">Escanee el código con la cámara de su celular para abrir el formulario.</p>
          {svg ? (
            <div role="img" aria-label="Código QR del formulario de postulación" data-testid="qr-formulario" className="w-56 rounded-xl border-2 border-[#00365f] p-3" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <p role="status">Generando código…</p>
          )}
          {codigo && <p data-testid="vigencia-qr" className="-mt-2 text-xs text-[#4d4d4d]">Vigente hasta el {fechaVence(codigo.exp)}</p>}
          <ol className="mt-2 flex w-full max-w-md flex-col gap-2 text-left">
            {PASOS_CARTEL.map((p, i) => (
              <li key={p} className="flex gap-3">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[#00365f] text-xs font-bold text-white">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          <div className="mt-2 w-full max-w-md rounded-lg bg-[#f4f5f9] p-4 text-left">
            <p className="font-bold text-[#00365f]">{DOCUMENTACION_TITULO}</p>
            <p className="mt-1 text-sm text-[#4d4d4d]">Se le pedirá:</p>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {DOCUMENTACION.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <p className="mt-2 border-t border-[#d5b16c] pt-3 text-sm text-[#4d4d4d]">El formulario es gratuito. No entregue dinero ni sus datos a intermediarios.</p>
        </div>
      </article>
    </div>
  );
}
