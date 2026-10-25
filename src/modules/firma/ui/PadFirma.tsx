"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/shared/ui/Button";
import {
  aligerar, COLOR_FONDO, COLOR_TINTA, elegirExportacion, firmaVacia, GROSOR_TRAZO, LIENZO_ALTO, LIENZO_ANCHO, puntoMedio,
  type Trazo,
} from "../domain/lienzo";

/** Draws all strokes as smooth quadratic curves through the midpoints of consecutive points. */
function dibujar(ctx: CanvasRenderingContext2D, trazos: readonly Trazo[]) {
  ctx.fillStyle = COLOR_FONDO;
  ctx.fillRect(0, 0, LIENZO_ANCHO, LIENZO_ALTO);
  ctx.strokeStyle = COLOR_TINTA;
  ctx.fillStyle = COLOR_TINTA;
  ctx.lineWidth = GROSOR_TRAZO;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const t of trazos) {
    if (t.length === 1) {
      ctx.beginPath();
      ctx.arc(t[0].x, t[0].y, GROSOR_TRAZO / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(t[0].x, t[0].y);
    for (let i = 1; i < t.length - 1; i++) {
      const m = puntoMedio(t[i], t[i + 1]);
      ctx.quadraticCurveTo(t[i].x, t[i].y, m.x, m.y);
    }
    ctx.lineTo(t[t.length - 1].x, t[t.length - 1].y);
    ctx.stroke();
  }
}

/** PNG/WebP data URL of the strokes within the size cap (null when not even the smallest attempt fits). */
export function exportarFirma(trazos: readonly Trazo[]): string | null {
  return elegirExportacion((e) => {
    const c = document.createElement("canvas");
    c.width = Math.round(LIENZO_ANCHO * e.escala);
    c.height = Math.round(LIENZO_ALTO * e.escala);
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.scale(e.escala, e.escala);
    dibujar(ctx, trazos);
    return c.toDataURL(e.mime, e.calidad);
  });
}

/**
 * Signature pad. Pointer events cover mouse, touch and stylus/signature tablets with the same code; `touch-action: none`
 * keeps the page from scrolling while signing. The canvas has a fixed logical size and is scaled by CSS, with a
 * backing store at the device pixel ratio for sharp lines. Ink is always dark on a light pad (both themes).
 */
export function PadFirma({ onConfirmar }: { onConfirmar: (dataUrl: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const trazos = useRef<Trazo[]>([]);
  const actual = useRef<{ trazo: Trazo; id: number } | null>(null);
  const [cantidad, setCantidad] = useState(0);
  const [error, setError] = useState("");
  const [activo, setActivo] = useState(false);

  const repintar = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dibujar(ctx, actual.current ? [...trazos.current, actual.current.trazo] : trazos.current);
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    c.width = Math.round(LIENZO_ANCHO * dpr);
    c.height = Math.round(LIENZO_ALTO * dpr);
    repintar();
  }, [repintar]);

  const punto = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * LIENZO_ANCHO) / r.width, y: ((e.clientY - r.top) * LIENZO_ALTO) / r.height };
  };

  function alBajar(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    actual.current = { trazo: [punto(e)], id: e.pointerId };
    setError("");
    setActivo(true);
    repintar();
  }
  function alMover(e: ReactPointerEvent<HTMLCanvasElement>) {
    const a = actual.current;
    if (!a || a.id !== e.pointerId) return;
    // Coalesced events keep fast strokes smooth on high-rate tablets; fall back to the event itself.
    const eventos = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    const r = e.currentTarget.getBoundingClientRect();
    for (const ev of eventos.length ? eventos : [e.nativeEvent]) {
      a.trazo.push({ x: ((ev.clientX - r.left) * LIENZO_ANCHO) / r.width, y: ((ev.clientY - r.top) * LIENZO_ALTO) / r.height });
    }
    repintar();
  }
  function alSoltar(e: ReactPointerEvent<HTMLCanvasElement>) {
    const a = actual.current;
    if (!a || a.id !== e.pointerId) return;
    actual.current = null;
    setActivo(false);
    trazos.current = [...trazos.current, aligerar(a.trazo)];
    setCantidad(trazos.current.length);
    repintar();
  }

  function deshacer() {
    trazos.current = trazos.current.slice(0, -1);
    setCantidad(trazos.current.length);
    setError("");
    repintar();
  }
  function borrar() {
    trazos.current = [];
    setCantidad(0);
    setError("");
    repintar();
  }
  function confirmar() {
    if (firmaVacia(trazos.current)) return setError("Dibuje la firma");
    const url = exportarFirma(trazos.current);
    if (!url) return setError("No se pudo guardar la firma en un tamaño aceptable. Bórrela y firme con un trazo más simple.");
    onConfirmar(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xl overflow-hidden rounded-lg border-2 border-muted bg-white">
        <canvas
          ref={canvas}
          role="img"
          aria-label="Área de firma. Firme con el dedo, el mouse o un lápiz. Si no es posible firmar en pantalla, use la verificación manual."
          data-testid="pad-firma"
          className="block aspect-[2/1] w-full cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        />
        {/* Guide only (not part of the exported image). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-[22%] border-b border-neutral-400" />
        {cantidad === 0 && !activo && (
          <p aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-neutral-500">
            Firme aquí
          </p>
        )}
      </div>
      <p role="status" className="text-sm text-muted">
        {cantidad === 0 ? "El área de firma está vacía." : `${cantidad} ${cantidad === 1 ? "trazo dibujado" : "trazos dibujados"}.`}
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={deshacer} disabled={cantidad === 0}>
          Deshacer último trazo
        </Button>
        <Button variant="secondary" onClick={borrar} disabled={cantidad === 0}>
          Borrar
        </Button>
        <Button onClick={confirmar}>Usar esta firma</Button>
      </div>
    </div>
  );
}
