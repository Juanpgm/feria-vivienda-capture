"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { detectarTarjeta, RELACION_TARJETA, type Rect } from "../domain/detectarTarjeta";
import type { TipoFoto } from "../domain/imagen";
import { revisarFoto } from "./analisis";
import { IlustracionCedula, PASO_FOTO } from "./GuiaCedula";

const MENSAJES: Record<string, string> = {
  NotAllowedError: "No pudimos usar la cámara porque el permiso fue denegado. Permítalo en el navegador o elija una foto de la galería.",
  NotFoundError: "No se encontró una cámara en este equipo. Elija una foto de la galería.",
  NotReadableError: "La cámara está siendo usada por otra aplicación. Ciérrela e intente de nuevo.",
};

const ANCHO_ANALISIS = 240; // detection runs on a 240 px wide copy of the frame
const CADA_MS = 200;
const ESTABLES_PARA_CAPTURAR = 5; // ~1 s of the card held still

type Captura = { blob: Blob; url: string; error: string };

/** True when two detections are (almost) the same place and size: the card is being held still. */
const mismaPosicion = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < a.w * 0.04 && Math.abs(a.y - b.y) < a.h * 0.04 && Math.abs(a.w - b.w) < a.w * 0.06;

/**
 * Full-screen guided camera. It looks for the card in every frame (a rectangle with the proportions of an ID card): the
 * outline turns green when it is found and the photo is taken by itself after ~1 s without moving; "Tomar foto" is always
 * there as the manual option. The image is cropped to the found card (or to the on-screen frame), then reviewed.
 */
export function CamaraGuiada({ tipo, alAceptar, alCerrar }: { tipo: TipoFoto; alAceptar: (b: Blob) => void; alCerrar: () => void }) {
  const paso = PASO_FOTO[tipo];
  const video = useRef<HTMLVideoElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState("");
  const [captura, setCaptura] = useState<Captura | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [encontrada, setEncontrada] = useState<Rect | null>(null); // in video pixels
  // The parent re-renders often (autosave status): keep the latest callback in a ref so the camera is opened only once.
  const cerrar = useRef(alCerrar);
  useEffect(() => {
    cerrar.current = alCerrar;
  });

  useEffect(() => {
    let flujo: MediaStream | undefined;
    let activo = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (!activo) return s.getTracks().forEach((t) => t.stop());
        flujo = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch((e: Error) => activo && setError(MENSAJES[e.name] ?? "No se pudo abrir la cámara. Elija una foto de la galería."));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar.current();
    document.addEventListener("keydown", esc);
    return () => {
      activo = false;
      flujo?.getTracks().forEach((t) => t.stop());
      document.removeEventListener("keydown", esc);
    };
  }, []);

  useEffect(() => () => void (captura && URL.revokeObjectURL(captura.url)), [captura]);

  // Frame in video pixels: 70 % of the height (or 90 % of the width), centred, card-shaped. It is the starting guide.
  const marco = dims && (() => {
    const w = Math.min(dims.w * 0.9, dims.h * 0.7 * RELACION_TARJETA);
    const h = w / RELACION_TARJETA;
    return { w, h, x: (dims.w - w) / 2, y: (dims.h - h) / 2 };
  })();

  const tomar = useCallback(
    (zona: Rect) => {
      const v = video.current;
      if (!v?.videoWidth) return;
      const c = document.createElement("canvas");
      c.width = Math.round(zona.w);
      c.height = Math.round(zona.h);
      c.getContext("2d")?.drawImage(v, zona.x, zona.y, zona.w, zona.h, 0, 0, c.width, c.height);
      setRevisando(true);
      c.toBlob(async (b) => {
        if (!b) {
          setRevisando(false);
          return setError("No se pudo tomar la foto. Intente de nuevo.");
        }
        const r = await revisarFoto(b);
        setCaptura({ blob: b, url: URL.createObjectURL(b), error: r.ok ? "" : r.mensaje });
        setRevisando(false);
      }, "image/jpeg", 0.92);
    },
    [],
  );

  // Look for the card ~5 times a second while the live view is on.
  const quieta = useRef<{ rect: Rect; n: number } | null>(null);
  useEffect(() => {
    if (!dims || !marco || captura || revisando || error) return;
    const escala = ANCHO_ANALISIS / dims.w;
    const w = ANCHO_ANALISIS;
    const h = Math.max(1, Math.round(dims.h * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    const guia: Rect = { x: marco.x * escala, y: marco.y * escala, w: marco.w * escala, h: marco.h * escala };
    quieta.current = null;
    const t = setInterval(() => {
      const v = video.current;
      if (!ctx || !v?.videoWidth) return;
      ctx.drawImage(v, 0, 0, w, h);
      const d = detectarTarjeta(ctx.getImageData(0, 0, w, h).data, w, h, guia);
      if (!d) {
        quieta.current = null;
        return setEncontrada(null);
      }
      const rect = { x: d.rect.x / escala, y: d.rect.y / escala, w: d.rect.w / escala, h: d.rect.h / escala };
      setEncontrada(rect);
      const previa = quieta.current;
      quieta.current = previa && mismaPosicion(previa.rect, rect) ? { rect, n: previa.n + 1 } : { rect, n: 1 };
      if (quieta.current.n >= ESTABLES_PARA_CAPTURAR) {
        quieta.current = null;
        tomar(rect);
      }
    }, CADA_MS);
    return () => clearInterval(t);
    // The guide only depends on the video size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims?.w, dims?.h, captura, revisando, error, tomar]);

  const zona = encontrada ?? marco;
  const pct = (r: Rect) =>
    dims ? { left: `${(r.x / dims.w) * 100}%`, top: `${(r.y / dims.h) * 100}%`, width: `${(r.w / dims.w) * 100}%`, height: `${(r.h / dims.h) * 100}%` } : {};

  return (
    <div role="dialog" aria-modal="true" aria-label={`Cámara guiada: ${paso.titulo}`} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-white/80">Paso {paso.numero} de 2</p>
          <h2 className="text-xl font-bold">{paso.titulo} de su cédula</h2>
          <p className="text-sm text-white/80">{paso.ayuda}</p>
        </div>
        <button type="button" onClick={alCerrar} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold underline underline-offset-2">
          Cerrar
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {error && <p role="alert" className="max-w-sm text-center font-medium">{error}</p>}
        {captura && (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL
          <img src={captura.url} alt={`Foto tomada: ${paso.titulo.toLowerCase()} de la cédula`} className="max-h-full max-w-full rounded-xl" />
        )}
        {/* The live view stays mounted (only hidden) while reviewing, so "Tomar de nuevo" resumes the same stream. */}
        {!error && (
          <div className={`relative max-h-full max-w-full ${captura ? "hidden" : ""}`} style={dims ? { aspectRatio: `${dims.w} / ${dims.h}`, height: "100%" } : { height: "100%" }}>
            <video
              ref={video}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => setDims({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
              aria-label="Vista de la cámara"
              className="size-full object-cover"
            />
            {dims && zona && (
              <div
                aria-hidden="true"
                className={`absolute rounded-2xl border-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-colors ${encontrada ? "border-green-400" : "border-white"}`}
                style={pct(zona)}
              >
                {!encontrada && <IlustracionCedula lado={tipo} className="size-full rounded-xl opacity-15" />}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        {captura ? (
          <>
            {captura.error ? (
              <p role="alert" className="rounded-lg bg-white p-3 font-medium text-danger">{captura.error}</p>
            ) : (
              <p role="status" className="font-semibold">¿Se lee bien todo el texto y se ve la cédula completa?</p>
            )}
            <div className="flex flex-wrap gap-2">
              {!captura.error && <Button onClick={() => alAceptar(captura.blob)}>Sí, usar esta foto</Button>}
              <Button variant="secondary" onClick={() => setCaptura(null)}>
                Tomar de nuevo
              </Button>
            </div>
          </>
        ) : (
          <>
            <p role="status" aria-live="polite" className={`text-lg font-semibold ${encontrada ? "text-green-300" : ""}`}>
              {revisando ? "Revisando la foto…" : encontrada ? "¡Cédula detectada! Manténgala quieta, tomamos la foto solos." : "Buscando la cédula… colóquela dentro del marco, completa y bien iluminada."}
            </p>
            <ul className="text-sm text-white/90">
              <li>• Ponga la cédula {tipo === "documento_frente" ? "con su foto hacia arriba" : "del lado del código de barras"}, sobre un fondo de otro color.</li>
              <li>• Sin reflejos, y que el texto se lea.</li>
            </ul>
            <div>
              <Button variant="secondary" disabled={!zona || revisando || !!error} onClick={() => zona && tomar(zona)}>
                Tomar foto manualmente
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
