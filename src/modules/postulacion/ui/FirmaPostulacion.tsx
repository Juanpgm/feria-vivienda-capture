"use client";

// Signature of the postulación: drawn on screen or, when that is not possible, an uploaded image of a valid signature.
// There is no manual verification here. Like the registro signature, it is sealed over the data and dropped when the
// data changes afterwards.
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { LIENZO_ALTO, LIENZO_ANCHO, MAX_FIRMA_BYTES } from "@/modules/firma/domain/lienzo";
import { FIRMA_VACIA, firmaVigente, selloDeDatos } from "@/modules/firma/domain/schema";
import { PadFirma } from "@/modules/firma/ui/PadFirma";
import { useError } from "@/modules/registro/ui/campos";
import { Button } from "@/shared/ui/Button";
import { evaluarTinta } from "../domain/firmaImagen";

const P = "firma";

/** Image file -> white-background JPEG/PNG data URL that fits the signature size cap, or an error message. */
async function prepararImagen(archivo: File): Promise<{ url: string } | { error: string }> {
  if (!archivo.type.startsWith("image/")) return { error: "El archivo no es una imagen. Suba una foto o un escaneo de la firma (JPG o PNG)." };
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(archivo);
  } catch {
    return { error: "No se pudo leer la imagen. Intente con otra (JPG o PNG)." };
  }
  if (img.width < 150 || img.height < 50) return { error: "La imagen es muy pequeña. Use una foto más nítida de la firma." };
  const escala = Math.min(1, LIENZO_ANCHO / img.width, LIENZO_ALTO / img.height);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const datos = ctx.getImageData(0, 0, c.width, c.height).data;
  const revision = evaluarTinta(datos);
  if (!revision.ok) return { error: revision.mensaje };
  for (const calidad of [0.85, 0.7, 0.55, 0.4]) {
    const url = c.toDataURL("image/jpeg", calidad);
    if ((url.length - url.indexOf(",") - 1) * 0.75 <= MAX_FIRMA_BYTES) return { url };
  }
  return { error: "La imagen es demasiado pesada. Recórtela para que solo se vea la firma e intente de nuevo." };
}

export function FirmaPostulacion() {
  const { setValue, getValues } = useFormContext<FieldValues>();
  const errores = useError();
  const error = errores("firma.metodo_firma") ?? errores("firma.imagen");
  const valores = useWatch() as Record<string, Record<string, unknown>>;
  const firma = valores.firma ?? {};
  const registrada = !!firma.metodo_firma && !!firma.sello;
  const vigente = registrada && firmaVigente(valores);
  const [modo, setModo] = useState<"pantalla" | "imagen">(firma.origen === "imagen" ? "imagen" : "pantalla");
  const [problema, setProblema] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  // Data edited after signing: the signature no longer covers what is on screen.
  useEffect(() => {
    if (registrada && !vigente) setValue(P, { ...FIRMA_VACIA, obsoleta: true }, { shouldDirty: true });
  }, [registrada, vigente, setValue]);

  const guardar = (url: string, origen: "pantalla" | "imagen") =>
    setValue(P, { ...FIRMA_VACIA, metodo_firma: "dibujada", imagen: url, origen, sello: selloDeDatos(getValues()) }, { shouldDirty: true, shouldValidate: true });

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setProblema("");
    const r = await prepararImagen(archivo);
    if ("error" in r) return setProblema(r.error);
    guardar(r.url, "imagen");
  }

  return (
    <section aria-labelledby="firma-titulo" className="flex flex-col gap-4 border-t border-border pt-8">
      <div>
        <h3 id="firma-titulo" className="text-lg font-bold text-primary-strong">Firma del solicitante</h3>
        <p className="mt-1 max-w-prose text-sm text-muted">Firme con el dedo, el mouse o un lápiz. Si no puede firmar en pantalla, suba una foto o un escaneo de su firma.</p>
      </div>
      {firma.obsoleta === true && (
        <p role="alert" className="rounded-lg bg-warning-bg p-3 font-medium text-warning-text">
          Los datos cambiaron después de firmar, por eso la firma se borró. Firme de nuevo.
        </p>
      )}

      {vigente ? (
        <div className="flex flex-col items-start gap-3">
          <p role="status" className="font-semibold text-success">
            Firma registrada{firma.origen === "imagen" ? " (imagen subida)" : ""}.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={String(firma.imagen)} alt="Firma del solicitante" className="h-28 w-56 rounded-lg border border-border bg-white object-contain" />
          <Button variant="secondary" onClick={() => setValue(P, { ...FIRMA_VACIA }, { shouldDirty: true })}>
            Firmar de nuevo
          </Button>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Cómo firma" className="flex w-full max-w-xl rounded-lg border border-border bg-surface p-1">
            {(["pantalla", "imagen"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modo === m}
                onClick={() => {
                  setModo(m);
                  setProblema("");
                }}
                className={`min-h-11 flex-1 rounded-md px-3 text-sm font-semibold ${modo === m ? "bg-bg text-primary-strong shadow-sm" : "text-muted"}`}
              >
                {m === "pantalla" ? "Firmar en pantalla" : "Subir imagen de la firma"}
              </button>
            ))}
          </div>
          {modo === "pantalla" ? (
            <PadFirma onConfirmar={(url) => guardar(url, "pantalla")} />
          ) : (
            <div className="flex max-w-xl flex-col gap-3">
              <p className="text-sm text-muted">La firma en tinta oscura sobre papel blanco, bien iluminada y recortada para que solo se vea la firma.</p>
              <input ref={entrada} type="file" accept="image/*" className="sr-only" aria-label="Archivo de imagen de la firma" onChange={alElegir} />
              <div>
                <Button onClick={() => entrada.current?.click()}>Elegir imagen de la firma</Button>
              </div>
            </div>
          )}
          {(problema || error) && (
            <p role="alert" className="text-sm font-medium text-danger">
              {problema || error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
