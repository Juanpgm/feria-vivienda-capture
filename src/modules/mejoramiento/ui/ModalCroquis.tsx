"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { post } from "@/modules/auth/ui/post";
import { ErrorFoto, procesarArchivo } from "@/modules/documentos/ui/procesarImagen";
import { Button } from "@/shared/ui/Button";
import { MAX_BYTES_ARCHIVO, MAX_CROQUIS } from "../domain/fotos";
import { subir } from "./enviarVisita";

type Elegido = { ref: string; blob: Blob; nombre: string; vista: string | null };
type Subida = { ref: string; url: string; headers: Record<string, string> };

const esPdf = async (f: Blob) => new TextDecoder().decode(await f.slice(0, 5).arrayBuffer()) === "%PDF-";


/**
 * "Cargar croquis" button + native modal dialog (S5): drag and drop or file picker, up to 4 images/PDFs,
 * images compressed in the browser, uploaded with server-issued presigned PUTs, then confirmed.
 * `onListo` runs after the confirmation; without it the page is refreshed.
 */
export function ModalCroquis({ id, codigo, onListo }: { id: string; codigo: string; onListo?: () => void }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const vistas = useRef<string[]>([]);
  const [elegidos, setElegidos] = useState<Elegido[]>([]);
  const [error, setError] = useState("");
  const [estado, setEstado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [encima, setEncima] = useState(false);
  const titulo = useId();

  useEffect(() => () => vistas.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function agregar(lista: FileList | null) {
    if (!lista?.length) return;
    setError("");
    setOcupado(true);
    setEstado("Preparando archivos...");
    const nuevos: Elegido[] = [];
    for (const f of Array.from(lista)) {
      if (elegidos.length + nuevos.length >= MAX_CROQUIS) {
        setError(`Máximo ${MAX_CROQUIS} archivos de croquis por visita.`);
        break;
      }
      try {
        if (await esPdf(f)) {
          if (f.size > MAX_BYTES_ARCHIVO) throw new ErrorFoto(`El PDF "${f.name}" supera ${MAX_BYTES_ARCHIVO / 1024 / 1024} MB.`);
          nuevos.push({ ref: crypto.randomUUID(), blob: new Blob([f], { type: "application/pdf" }), nombre: f.name, vista: null });
        } else {
          const { blob } = await procesarArchivo(f);
          const vista = URL.createObjectURL(blob);
          vistas.current.push(vista);
          nuevos.push({ ref: crypto.randomUUID(), blob, nombre: f.name, vista });
        }
      } catch (e) {
        setError(e instanceof ErrorFoto ? e.message : `No se pudo leer "${f.name}". Elija una imagen o un PDF.`);
      }
    }
    setElegidos((a) => [...a, ...nuevos]);
    setEstado("");
    setOcupado(false);
    if (entrada.current) entrada.current.value = "";
  }

  function quitar(ref: string) {
    const e = elegidos.find((x) => x.ref === ref);
    if (e?.vista) URL.revokeObjectURL(e.vista);
    setElegidos((a) => a.filter((x) => x.ref !== ref));
  }

  function soltar(ev: DragEvent<HTMLDivElement>) {
    ev.preventDefault();
    setEncima(false);
    if (!ocupado) void agregar(ev.dataTransfer.files);
  }

  async function guardar() {
    setOcupado(true);
    setError("");
    setEstado("Subiendo croquis...");
    const fallo = (m: string) => {
      setError(m);
      setEstado("");
      setOcupado(false);
    };
    const r = await post(`/api/visitas/${id}/croquis`, { archivos: elegidos.map((e) => ({ ref: e.ref, content_type: e.blob.type, bytes: e.blob.size })) });
    if (r.error) return fallo(r.error);
    try {
      let n = 0;
      for (const s of r.data.subidas as Subida[]) {
        await subir(s.url, s.headers, elegidos.find((e) => e.ref === s.ref)!.blob);
        setEstado(`Subiendo croquis... ${++n} de ${elegidos.length}`);
      }
    } catch {
      return fallo("No se pudieron subir los archivos. Revise la conexión e intente de nuevo.");
    }
    const c = await post(`/api/visitas/${id}/croquis/confirmar`);
    if (c.error) return fallo(c.error);
    setEstado("");
    setOcupado(false);
    setElegidos([]);
    dialogo.current?.close();
    if (onListo) onListo();
    else router.refresh();
  }

  return (
    <>
      <Button ref={disparador} variant="secondary" className="min-h-9 px-3 text-sm" onClick={() => dialogo.current?.showModal()} aria-label={`Cargar croquis de la visita ${codigo}`}>
        Cargar croquis
      </Button>
      <dialog
        ref={dialogo}
        aria-labelledby={titulo}
        onCancel={(e) => ocupado && e.preventDefault()}
        onClose={() => disparador.current?.isConnected && disparador.current.focus()}
        className="m-auto w-[min(40rem,calc(100%-2rem))] rounded-xl border border-border bg-bg p-6 text-left text-text backdrop:bg-black/50"
      >
        <h2 id={titulo} className="text-lg font-bold text-primary-strong">
          Cargar croquis · {codigo}
        </h2>
        <p className="mt-1 text-sm text-muted">Hasta {MAX_CROQUIS} archivos: fotos del croquis o PDF. Las fotos se reducen antes de subirlas.</p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={soltar}
          className={`mt-4 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 text-center ${encima ? "border-primary bg-surface" : "border-border"}`}
        >
          <p className="text-sm">Arrastre los archivos aquí o</p>
          <Button variant="secondary" disabled={ocupado || elegidos.length >= MAX_CROQUIS} onClick={() => entrada.current?.click()}>
            Elegir archivos
          </Button>
          <input
            ref={entrada}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="sr-only"
            tabIndex={-1}
            aria-label="Elegir archivos de croquis"
            onChange={(e) => void agregar(e.currentTarget.files)}
          />
        </div>
        {elegidos.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Archivos elegidos">
            {elegidos.map((e) => (
              <li key={e.ref} className="flex flex-col gap-1">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
                  {e.vista ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL
                    <img src={e.vista} alt={`Vista previa: ${e.nombre}`} className="size-full object-contain" />
                  ) : (
                    <span className="px-2 text-sm font-semibold">PDF</span>
                  )}
                </div>
                <span className="truncate text-xs text-muted" title={e.nombre}>
                  {e.nombre}
                </span>
                <Button variant="secondary" className="min-h-9 px-2 text-sm" disabled={ocupado} onClick={() => quitar(e.ref)} aria-label={`Quitar ${e.nombre}`}>
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div aria-live="polite" className="mt-3">
          <p role="alert" className="text-sm font-medium text-danger empty:hidden">
            {error}
          </p>
          <p className="text-sm empty:hidden">{estado}</p>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={ocupado} onClick={() => dialogo.current?.close()}>
            Cancelar
          </Button>
          <Button disabled={ocupado || !elegidos.length} onClick={guardar}>
            Guardar croquis
          </Button>
        </div>
      </dialog>
    </>
  );
}
