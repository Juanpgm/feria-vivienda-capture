"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { analizarTarjeta, RELACION_TARJETA, type Analisis, type Rect } from "../domain/detectarTarjeta";
import type { TipoFoto } from "../domain/imagen";
import { revisarFoto } from "./analisis";
import { IlustracionCedula, PASO_FOTO } from "./GuiaCedula";

const MENSAJES: Record<string, string> = {
  NotAllowedError: "No pudimos usar la cámara porque el permiso fue denegado. Permítalo en el navegador o elija una foto de la galería.",
  NotFoundError: "No se encontró una cámara en este equipo. Elija una foto de la galería.",
  NotReadableError: "La cámara está siendo usada por otra aplicación. Ciérrela e intente de nuevo.",
};

const ANCHO_ANALISIS = 320; // detection runs on a 320 px wide copy of the frame
const CADA_MS = 180;
const ESTABLES_PARA_CAPTURAR = 6; // ~1 s with the whole card held still
const MARGEN_RECORTE = 0.02; // crop a little outside the detected contour so no edge is lost
const INTENTO_MS = 5000; // one detection attempt = 5 s looking for the card
const INTENTOS = 3; // after this many attempts without a complete card, point to the manual shot

type Captura = { blob: Blob; url: string; error: string };
type Luz = "ok" | "poca" | "mucha";

/** Mean brightness of the live frame (sampled): too dark or burnt-out frames make detection and the photo itself fail. */
function luzDe(data: Uint8ClampedArray): Luz {
  let suma = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 64) {
    suma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n++;
  }
  const media = n ? suma / n : 128;
  return media < 55 ? "poca" : media > 225 ? "mucha" : "ok";
}
type Vista = { analisis: Analisis; rect: Rect | null; estables: number };

/** True when two detections are (almost) the same place and size: the card is being held still. */
const mismaPosicion = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < a.w * 0.04 && Math.abs(a.y - b.y) < a.h * 0.04 && Math.abs(a.w - b.w) < a.w * 0.06;

const BORDE: Record<string, string> = { izquierdo: "izquierdo", derecho: "derecho", superior: "de arriba", inferior: "de abajo" };

function mensajeDe(a: Analisis, estables: number, intento: number): { texto: string; tono: "neutro" | "aviso" | "ok" } {
  switch (a.estado) {
    case "completa":
      return { texto: estables >= 2 ? "¡Cédula completa! Manténgala quieta, tomamos la foto solos." : "Cédula completa. Manténgala quieta un momento.", tono: "ok" };
    case "ajustar":
      return { texto: a.problema === "pequena" ? "Acerque un poco la cédula." : "La cédula se sale de la imagen. Aléjela un poco.", tono: "aviso" };
    case "parcial":
      return { texto: `No vemos el borde ${BORDE[a.faltante]} de la cédula. Muéstrela completa.`, tono: "aviso" };
    default:
      return { texto: `Buscando la cédula (intento ${intento} de ${INTENTOS})… colóquela completa sobre un fondo de otro color y bien iluminada.`, tono: "neutro" };
  }
}

/**
 * Full-screen guided camera. It looks for the whole card in every frame: the outline follows its real contour and turns
 * green only when the four sides are visible, it is not cut and it is big enough to read; then, after ~1 s without
 * moving, the photo is taken by itself. While it is not complete the screen says what to fix ("acerque", "muéstrela
 * completa"). "Tomar foto manualmente" is always there. The image is cropped to the detected card, then reviewed.
 */
export function CamaraGuiada({ tipo, alAceptar, alCerrar }: { tipo: TipoFoto; /** `forzada`: the person kept a photo the checks did not like. */ alAceptar: (b: Blob, forzada?: boolean) => void; alCerrar: () => void }) {
  const paso = PASO_FOTO[tipo];
  const video = useRef<HTMLVideoElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState("");
  const [captura, setCaptura] = useState<Captura | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [sugerirManual, setSugerirManual] = useState(false);
  // Manual framing: the detector is off, the person lines the card up with the guide and the WHOLE frame is saved.
  const [manual, setManual] = useState(false);
  const [intento, setIntento] = useState(1);
  const [luz, setLuz] = useState<Luz>("ok");
  const [ronda, setRonda] = useState(0); // bumped by "Volver a intentar": restarts the detection attempts
  const [vista, setVista] = useState<Vista>({ analisis: { estado: "ninguna" }, rect: null, estables: 0 });
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

  // Starting guide in video pixels: 70 % of the height (or 90 % of the width), centred, card-shaped.
  const marco = dims && (() => {
    const w = Math.min(dims.w * 0.9, dims.h * 0.7 * RELACION_TARJETA);
    const h = w / RELACION_TARJETA;
    return { w, h, x: (dims.w - w) / 2, y: (dims.h - h) / 2 };
  })();

  const tomar = useCallback((zonaPedida?: Rect, margen = MARGEN_RECORTE) => {
    const v = video.current;
    if (!v?.videoWidth) return;
    // No zone (detector or guide not ready): the whole frame. The manual shot must never be blocked by the detection.
    const zona = zonaPedida ?? { x: 0, y: 0, w: v.videoWidth, h: v.videoHeight };
    const mx = zona.w * margen;
    const my = zona.h * margen;
    const x = Math.max(0, zona.x - mx);
    const y = Math.max(0, zona.y - my);
    const w = Math.min(v.videoWidth - x, zona.w + 2 * mx);
    const h = Math.min(v.videoHeight - y, zona.h + 2 * my);
    const c = document.createElement("canvas");
    c.width = Math.round(w);
    c.height = Math.round(h);
    c.getContext("2d")?.drawImage(v, x, y, w, h, 0, 0, c.width, c.height);
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
  }, []);

  // Analyze the live view ~5 times a second.
  const quieta = useRef<{ rect: Rect; n: number } | null>(null);
  useEffect(() => {
    if (!dims || !marco || captura || revisando || error || manual) return;
    const escala = ANCHO_ANALISIS / dims.w;
    const w = ANCHO_ANALISIS;
    const h = Math.max(1, Math.round(dims.h * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    const guia: Rect = { x: marco.x * escala, y: marco.y * escala, w: marco.w * escala, h: marco.h * escala };
    quieta.current = null;
    let inicio = Date.now(); // start of the current run of looks without a complete card
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    // Self-scheduling: a slow phone never piles up analyses, it just looks a bit less often.
    const paso = () => {
      if (!vivo) return;
      analizar();
      timer = setTimeout(paso, CADA_MS);
    };
    const analizar = () => {
      const v = video.current;
      if (!ctx || !v?.videoWidth) return;
      let pixeles: Uint8ClampedArray;
      let a: Analisis;
      try {
        ctx.drawImage(v, 0, 0, w, h);
        pixeles = ctx.getImageData(0, 0, w, h).data;
        setLuz(luzDe(pixeles));
        a = analizarTarjeta(pixeles, w, h, guia);
      } catch {
        // The detector could not run on this device: say so and leave the manual shot as the way forward.
        setSugerirManual(true);
        return;
      }
      const rect = "rect" in a ? { x: a.rect.x / escala, y: a.rect.y / escala, w: a.rect.w / escala, h: a.rect.h / escala } : null;
      if (a.estado !== "completa" || !rect) {
        quieta.current = null;
        const n = Math.floor((Date.now() - inicio) / INTENTO_MS) + 1;
        setIntento(Math.min(n, INTENTOS));
        if (n > INTENTOS) setSugerirManual(true);
        return setVista({ analisis: a, rect, estables: 0 });
      }
      inicio = Date.now();
      setIntento(1);
      setSugerirManual(false);
      const previa = quieta.current;
      quieta.current = previa && mismaPosicion(previa.rect, rect) ? { rect, n: previa.n + 1 } : { rect, n: 1 };
      setVista({ analisis: a, rect, estables: quieta.current.n });
      if (quieta.current.n >= ESTABLES_PARA_CAPTURAR) {
        quieta.current = null;
        tomar(rect);
      }
    };
    timer = setTimeout(paso, CADA_MS);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
    // The guide only depends on the video size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims?.w, dims?.h, captura, revisando, error, manual, tomar, ronda]);

  const zona = vista.rect ?? marco;
  const completa = vista.analisis.estado === "completa";
  const ajustar = vista.analisis.estado === "ajustar";
  // After a few seconds without a complete card the screen stops guessing and says what to do.
  const msg = sugerirManual && !completa ? { texto: "No se pudo detectar la cédula. Tome la foto manualmente.", tono: "aviso" as const } : mensajeDe(vista.analisis, vista.estables, intento);
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

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2">
        {error && <p role="alert" className="max-w-sm text-center font-medium">{error}</p>}
        {captura && (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL
          <img src={captura.url} alt={`Foto tomada: ${paso.titulo.toLowerCase()} de la cédula`} className="max-h-full max-w-full rounded-xl" />
        )}
        {/* The live view stays mounted (only hidden) while reviewing, so "Tomar de nuevo" resumes the same stream. */}
        {!error && (
          <div className={`relative max-h-full max-w-full overflow-hidden ${captura ? "hidden" : ""}`} style={dims ? { aspectRatio: `${dims.w} / ${dims.h}`, height: "100%" } : { height: "100%" }}>
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
                className={`absolute rounded-2xl border-4 transition-[border-color,left,top,width,height] duration-150 ${
                  manual ? "border-dashed border-white" : `shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] ${completa ? "border-green-400" : ajustar ? "border-amber-300" : "border-white"}`
                }`}
                style={pct(manual ? marco! : zona)}
              >
                {(manual || !vista.rect) && <IlustracionCedula lado={tipo} className="size-full rounded-xl opacity-15" />}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-col gap-3 bg-black p-4">
        {error ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-lg font-semibold">No se pudo abrir la cámara.</p>
            <p className="text-sm text-white/90">Cierre esta ventana y use «Elegir de la galería» para subir la foto de su cédula, o permita el acceso a la cámara en el navegador y vuelva a intentar.</p>
            <Button onClick={alCerrar}>Cerrar</Button>
          </div>
        ) : captura ? (
          <>
            {captura.error ? (
              <p role="alert" className="rounded-lg bg-white p-3 font-medium text-danger">
                {captura.error} Si en la imagen se ve bien la cédula, puede usarla de todos modos.
              </p>
            ) : (
              <p role="status" className="font-semibold">¿Se lee bien todo el texto y se ve la cédula completa?</p>
            )}
            <div className="flex flex-wrap gap-2">
              {!captura.error && <Button onClick={() => alAceptar(captura.blob)}>Sí, usar esta foto</Button>}
              <Button
                variant={captura.error ? "primary" : "secondary"}
                onClick={() => {
                  setCaptura(null);
                  setSugerirManual(false);
                  setIntento(1);
                }}
              >
                Tomar de nuevo
              </Button>
              {captura.error && (
                <Button variant="secondary" onClick={() => alAceptar(captura.blob, true)}>
                  Usar de todos modos
                </Button>
              )}
            </div>
          </>
        ) : manual ? (
          <>
            <p role="status" aria-live="polite" className="text-lg font-semibold">
              {revisando ? "Revisando la foto…" : "Encuadre la cédula completa dentro del marco."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={revisando} onClick={() => tomar(undefined, 0)}>
                Capturar foto
              </Button>
              <Button
                variant="secondary"
                disabled={revisando}
                onClick={() => {
                  setManual(false);
                  setSugerirManual(false);
                  setIntento(1);
                  setRonda((r) => r + 1);
                }}
              >
                Volver a la detección automática
              </Button>
            </div>
            <ul className="text-sm text-white/90">
              <li>• Se guarda la imagen completa de la cámara, sin recortar: acomode la cédula dentro del marco y que se vean sus cuatro bordes.</li>
              <li>• Con buena luz y sin reflejos.</li>
            </ul>
          </>
        ) : (
          <>
            <p role="status" aria-live="polite" className={`text-lg font-semibold ${msg.tono === "ok" ? "text-green-300" : msg.tono === "aviso" ? "text-amber-200" : ""}`}>
              {revisando ? "Revisando la foto…" : msg.texto}
            </p>
            <div className="flex flex-col items-start gap-2">
              <Button
                variant="primary"
                disabled={revisando}
                onClick={() => setManual(true)}
              >
                Tomar foto manualmente
              </Button>
              {sugerirManual && !completa && (
                <>
                  <p className="text-sm text-white/90">Use «Tomar foto manualmente» y encuadre la cédula usted. Si el fondo es blanco, ponga algo oscuro debajo para mejorar la detección.</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSugerirManual(false);
                      setIntento(1);
                      setRonda((r) => r + 1);
                    }}
                  >
                    Volver a intentar detectarla
                  </Button>
                </>
              )}
            </div>
            {completa && (
              <div aria-hidden="true" className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-green-400 transition-[width] duration-150" style={{ width: `${Math.min(100, (vista.estables / ESTABLES_PARA_CAPTURAR) * 100)}%` }} />
              </div>
            )}
            {luz !== "ok" && !completa && (
              <p role="status" className="rounded-lg bg-amber-200 p-2 text-sm font-semibold text-black">
                {luz === "poca" ? "Hay poca luz. Busque un lugar más iluminado o encienda una luz." : "Hay demasiada luz o reflejo. Incline un poco la cédula para evitar el brillo."}
              </p>
            )}
            <ul className="text-sm text-white/90">
              <li>• Ponga la cédula {tipo === "documento_frente" ? "con su foto hacia arriba" : "del lado del código de barras"}, sobre un fondo de otro color.</li>
              <li>• Sin reflejos, y que el texto se lea. Se toma sola al detectarla; si prefiere, use «Tomar foto manualmente» y encuádrela usted.</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
