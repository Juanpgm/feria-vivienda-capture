"use client";

import { useId, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/shared/ui/Button";

export type FotoGaleria = { src?: string; alt: string };

const UMBRAL_SWIPE = 50;

/**
 * Photo count as a link ("3 fotos") that opens a native modal carousel: full screen on phones, one photo at a time
 * (object-contain), Anterior/Siguiente, swipe, arrow keys, "2 de 3", thumbnails to jump. Images are
 * loading="lazy", so nothing is fetched while the dialog is closed (display: none). `onQuitar` adds "Quitar esta foto" (the form's drafts).
 */
export function GaleriaFotos({ fotos, item, titulo, onQuitar }: { fotos: FotoGaleria[]; item: string; titulo: string; onQuitar?: (i: number) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const tituloId = useId();
  const [indice, setIndice] = useState(0);
  const inicioX = useRef<number | null>(null);
  const n = fotos.length;
  const i = Math.min(indice, Math.max(n - 1, 0));
  const ir = (k: number) => setIndice((k + n) % n);
  const actual = fotos[i];

  function abrir(k = 0) {
    setIndice(k);
    dialogo.current?.showModal();
  }
  function quitar() {
    if (n === 1) dialogo.current?.close();
    onQuitar?.(i);
  }
  const soltar = (e: PointerEvent) => {
    if (inicioX.current == null) return;
    const dx = e.clientX - inicioX.current;
    inicioX.current = null;
    if (Math.abs(dx) >= UMBRAL_SWIPE && n > 1) ir(i + (dx < 0 ? 1 : -1));
  };

  return (
    <>
      {n ? (
        <button
          ref={disparador}
          type="button"
          aria-label={`Ver ${n} ${n === 1 ? "foto" : "fotos"} de ${item}`}
          onClick={() => abrir()}
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline underline-offset-2 hover:text-primary-strong"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          {n} {n === 1 ? "foto" : "fotos"}
        </button>
      ) : (
        <span className="text-sm text-muted">Sin fotos</span>
      )}
      <dialog
        ref={dialogo}
        aria-labelledby={tituloId}
        onClose={() => disparador.current?.isConnected && disparador.current.focus()}
        onKeyDown={(e) => {
          if (n < 2) return;
          if (e.key === "ArrowRight") ir(i + 1);
          else if (e.key === "ArrowLeft") ir(i - 1);
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none flex-col bg-bg p-0 text-text backdrop:bg-black/70 open:flex sm:m-auto sm:h-[min(52rem,calc(100dvh-4rem))] sm:w-[min(56rem,calc(100%-2rem))] sm:rounded-xl sm:border sm:border-border"
      >
        <header className="flex items-start gap-3 border-b border-border p-3">
          <div className="min-w-0 flex-1">
            <h2 id={tituloId} className="text-lg font-bold text-primary-strong">Fotos de {item}</h2>
            <p className="text-sm [overflow-wrap:anywhere]">{titulo}</p>
          </div>
          <Button variant="secondary" className="min-h-12" onClick={() => dialogo.current?.close()}>Cerrar</Button>
        </header>
        {actual && (
          <>
            <figure className="flex min-h-0 flex-1 flex-col">
              <div
                className="flex min-h-0 flex-1 touch-pan-y select-none items-center justify-center bg-surface p-2"
                onPointerDown={(e) => (inicioX.current = e.clientX)}
                onPointerUp={soltar}
                onPointerCancel={() => (inicioX.current = null)}
              >
                {actual.src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob or short-lived presigned URL
                  <img key={actual.src} src={actual.src} alt={actual.alt} loading="lazy" draggable={false} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-muted">Cargando foto…</span>
                )}
              </div>
              <figcaption className="flex flex-wrap items-center gap-x-3 px-3 pt-2 text-sm">
                <span className="font-semibold" aria-live="polite">{i + 1} de {n}</span>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-muted">{actual.alt}</span>
              </figcaption>
            </figure>
            <div className="flex flex-wrap items-center gap-2 p-3">
              <Button variant="secondary" className="min-h-12 flex-1 sm:flex-none" disabled={n < 2} onClick={() => ir(i - 1)}>Anterior</Button>
              <Button variant="secondary" className="min-h-12 flex-1 sm:flex-none" disabled={n < 2} onClick={() => ir(i + 1)}>Siguiente</Button>
              {onQuitar && <Button variant="danger" className="min-h-12 w-full sm:ml-auto sm:w-auto" onClick={quitar}>Quitar esta foto</Button>}
            </div>
            {n > 1 && (
              <ul className="flex gap-2 overflow-x-auto px-3 pb-3" aria-label="Miniaturas">
                {fotos.map((f, k) => (
                  <li key={k} className="shrink-0">
                    <button
                      type="button"
                      aria-label={`Ir a la foto ${k + 1}`}
                      aria-current={k === i || undefined}
                      onClick={() => setIndice(k)}
                      className={`grid size-14 place-items-center overflow-hidden rounded-md border-2 bg-surface text-xs ${k === i ? "border-primary" : "border-border"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob or short-lived presigned URL */}
                      {f.src ? <img src={f.src} alt="" loading="lazy" className="size-full object-cover" /> : k + 1}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
