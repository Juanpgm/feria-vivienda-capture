"use client";

import { useEffect, useState } from "react";
import { ETIQUETA_ADJUNTO, formatoTamano, TIPOS_FOTO, type TipoFoto } from "../domain/imagen";
import { cargarFoto, type FotoGuardada } from "./fotos";
import { useMiniatura } from "./FotoCaptura";

function Miniatura({ tipo, foto }: { tipo: TipoFoto; foto: FotoGuardada | null | undefined }) {
  const url = useMiniatura(foto?.blob);
  return (
    <figure className="flex w-full max-w-56 flex-col gap-1">
      <div className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
        {foto && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL of a local file
          <img src={url} alt={`Vista previa: ${ETIQUETA_ADJUNTO[tipo].toLowerCase()}`} className="size-full object-contain" />
        ) : (
          <span className="px-2 text-center text-sm font-medium text-danger">{foto === undefined ? "Cargando…" : "Falta la foto"}</span>
        )}
      </div>
      <figcaption className="text-sm">
        <span className="font-semibold">{ETIQUETA_ADJUNTO[tipo]}</span>
        {foto && <span className="text-muted"> · {formatoTamano(foto.bytes)}</span>}
      </figcaption>
    </figure>
  );
}

/**
 * Review block for the summary step (same heading + "Editar" pattern as the other sections): thumbnails of the
 * stored photos. `onCompleto(true)` reports whether both are present so the summary can gate the submit button.
 */
export function FotosResumen({ borradorId, irAPaso, onCompleto }: { borradorId: string; irAPaso?: (id: string, ancla?: string) => void; onCompleto?: (ok: boolean) => void }) {
  const [fotos, setFotos] = useState<Record<TipoFoto, FotoGuardada | null | undefined>>({ documento_frente: undefined, documento_reverso: undefined });

  useEffect(() => {
    let vivo = true;
    Promise.all(TIPOS_FOTO.map((t) => cargarFoto(borradorId, t).catch(() => undefined))).then(([f, r]) => {
      if (!vivo) return;
      setFotos({ documento_frente: f ?? null, documento_reverso: r ?? null });
      onCompleto?.(!!f && !!r);
    });
    return () => {
      vivo = false;
    };
  }, [borradorId, onCompleto]);

  return (
    <section aria-labelledby="resumen-documentos">
      <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-border pb-1">
        <h3 id="resumen-documentos" className="text-lg font-bold text-primary-strong">
          Documento de identidad
        </h3>
        {irAPaso && (
          <button
            type="button"
            onClick={() => irAPaso("autorizacion", "seccion-documentos")}
            aria-label="Editar Documento de identidad"
            className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline underline-offset-2"
          >
            Editar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        {TIPOS_FOTO.map((t) => (
          <Miniatura key={t} tipo={t} foto={fotos[t]} />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">Las fotos solo las ve el personal administrador.</p>
    </section>
  );
}
