"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { Button } from "@/shared/ui/Button";
import { ETIQUETA_ADJUNTO, formatoTamano, type TipoFoto } from "../domain/imagen";
import { FOTO_CAPTURADA } from "../domain/schema";
import { sonLaMismaFoto, revisarFoto } from "./analisis";
import { CamaraGuiada } from "./CamaraGuiada";
import { IlustracionCedula, PASO_FOTO } from "./GuiaCedula";
import { cargarFoto, guardarFoto, quitarFoto, type FotoGuardada } from "./fotos";
import { ErrorFoto, procesarArchivo } from "./procesarImagen";

/** Object URL of a stored photo for as long as the component shows it. */
export function useMiniatura(blob: Blob | undefined) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    // Synchronizing with an external resource (object URL lifecycle): the state is the URL handed to <img>.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return blob ? url : "";
}

const puedeUsarCamara = () => !!navigator.mediaDevices?.getUserMedia;

/** Capture block of ONE side of the document: native picker/camera, optional live camera on desktop, preview, retake, remove. */
export function FotoCaptura({ borradorId, tipo, errorFormulario, bloqueada }: { borradorId: string; tipo: TipoFoto; errorFormulario?: string; /** Why this side cannot be taken yet (the other one comes first). */ bloqueada?: string }) {
  const { setValue, getValues } = useFormContext<FieldValues>();
  const campo = `documentos.${tipo}`;
  const etiqueta = ETIQUETA_ADJUNTO[tipo];
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const botonCamara = useRef<HTMLButtonElement>(null);
  const acciones = useRef<HTMLDivElement>(null);
  const [foto, setFoto] = useState<FotoGuardada | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [camara, setCamara] = useState(false);
  const hayCamara = useSyncExternalStore(() => () => {}, puedeUsarCamara, () => false);
  const url = useMiniatura(foto?.blob);

  // The device is the source of truth: a marker without a stored photo (or the reverse) is repaired on mount.
  useEffect(() => {
    let vivo = true;
    cargarFoto(borradorId, tipo)
      .catch(() => undefined)
      .then((f) => {
        if (!vivo) return;
        setFoto(f ?? null);
        const marcada = getValues(campo) === FOTO_CAPTURADA;
        if (!!f !== marcada) setValue(campo, f ? FOTO_CAPTURADA : "", { shouldDirty: true });
      });
    return () => {
      vivo = false;
    };
  }, [borradorId, tipo, campo, getValues, setValue]);

  async function recibir(archivo: Blob, forzar = false) {
    setCamara(false);
    setError("");
    setProcesando(true);
    try {
      const p = await procesarArchivo(archivo);
      // Must look like a document photo (sharp, lit, textured, horizontal) and not be the same picture as the other side.
      // A photo the person kept from the camera after the warning (`forzar`) is not blocked by the quality check.
      if (!forzar) {
        const calidad = await revisarFoto(p.blob);
        if (!calidad.ok) throw new ErrorFoto(calidad.mensaje);
      }
      const otra = await cargarFoto(borradorId, tipo === "documento_frente" ? "documento_reverso" : "documento_frente").catch(() => undefined);
      if (otra && (await sonLaMismaFoto(p.blob, otra.blob)))
        throw new ErrorFoto(tipo === "documento_reverso" ? "Esta es la misma foto del frente. Ahora tome la parte de atrás de la cédula." : "Esta es la misma foto de la parte de atrás. Aquí va el frente, donde sale su foto.");
      const nueva: FotoGuardada = { blob: p.blob, bytes: p.blob.size, mime: "image/jpeg", ancho: p.ancho, alto: p.alto, capturada_en: new Date().toISOString() };
      // Stored BEFORE the draft says "captured", so the draft never claims a photo that does not exist.
      await guardarFoto(borradorId, tipo, nueva).catch(() => {
        throw new ErrorFoto("No se pudo guardar la foto en este equipo. Libere espacio o use otro navegador e intente de nuevo.");
      });
      setFoto(nueva);
      setValue(campo, FOTO_CAPTURADA, { shouldDirty: true, shouldValidate: true });
    } catch (e) {
      setError(e instanceof ErrorFoto ? e.message : "No se pudo procesar la foto. Intente con otra.");
    } finally {
      setProcesando(false);
    }
  }

  async function quitar() {
    setError("");
    await quitarFoto(borradorId, tipo).catch(() => undefined);
    setFoto(null);
    setValue(campo, "", { shouldDirty: true });
    requestAnimationFrame(() => acciones.current?.querySelector("button")?.focus());
  }

  const mensaje = error || (bloqueada ? "" : errorFormulario);
  return (
    <section aria-labelledby={`${id}-t`} className="flex flex-col gap-3">
      <h4 id={`${id}-t`} className="text-lg font-bold text-primary-strong">
        {PASO_FOTO[tipo].numero}. {PASO_FOTO[tipo].titulo} de la cédula
      </h4>
      <p className="text-sm text-muted">{PASO_FOTO[tipo].ayuda}</p>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        aria-label={`Archivo de imagen: ${etiqueta.toLowerCase()}`}
        aria-describedby={mensaje ? `${id}-e` : undefined}
        aria-invalid={mensaje ? true : undefined}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = ""; // lets the same file be chosen again
          if (archivo) void recibir(archivo);
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex aspect-[3/2] w-full max-w-72 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
          {!url && !procesando ? (
            <IlustracionCedula lado={tipo} className="w-4/5" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: URL of a local file, not optimizable
            <img src={url} alt={`Vista previa: ${etiqueta.toLowerCase()}`} className="size-full object-contain" />
          ) : (
            <p className="px-3 text-center text-sm text-muted">{procesando ? "Procesando…" : "Sin foto"}</p>
          )}
        </div>

        <div className="flex flex-col items-start gap-3">
          {foto && (
            <p className="text-sm text-muted">
              {formatoTamano(foto.bytes)} · {foto.ancho} × {foto.alto} px
            </p>
          )}
          <div ref={acciones} className="flex flex-wrap gap-2">
            {hayCamara ? (
              <Button ref={botonCamara} variant={foto ? "secondary" : "primary"} disabled={procesando || !!bloqueada} onClick={() => setCamara(true)}>
                {foto ? "Volver a tomar" : "Abrir la cámara"}
              </Button>
            ) : null}
            <Button variant={hayCamara || foto ? "secondary" : "primary"} disabled={procesando || !!bloqueada} onClick={() => entrada.current?.click()}>
              {hayCamara ? "Elegir de la galería" : "Tomar o elegir foto"}
            </Button>
            {foto && (
              <Button variant="secondary" disabled={procesando} onClick={quitar}>
                Quitar
              </Button>
            )}
          </div>
        </div>
      </div>

      {camara && (
        <CamaraGuiada
          tipo={tipo}
          alAceptar={(b, forzada) => void recibir(b, forzada)}
          alCerrar={() => {
            setCamara(false);
            requestAnimationFrame(() => botonCamara.current?.focus());
          }}
        />
      )}

      {bloqueada && <p className="text-sm font-medium">{bloqueada}</p>}
      <p aria-live="polite" className="text-sm text-muted">
        {procesando ? `Procesando la foto: ${etiqueta.toLowerCase()}…` : foto && !mensaje ? "Foto lista." : ""}
      </p>
      {mensaje && (
        <p id={`${id}-e`} role="alert" className="text-sm font-medium text-danger">
          {mensaje}
        </p>
      )}
    </section>
  );
}
