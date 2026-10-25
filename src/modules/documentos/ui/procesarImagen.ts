// Browser-side photo pipeline: sniff -> decode (EXIF orientation applied) -> downscale -> JPEG re-encode until it fits.
import { comprimirHasta, detectarFormato, dimensionesFinales, errorDeFormato, MAX_FOTO_BYTES } from "../domain/imagen";

export class ErrorFoto extends Error {}

export type FotoProcesada = { blob: Blob; ancho: number; alto: number };

type Fuente = { imagen: CanvasImageSource; ancho: number; alto: number; liberar: () => void };

async function decodificar(archivo: Blob): Promise<Fuente> {
  try {
    // "from-image" bakes the EXIF rotation into the pixels. Older engines throw on the option and use the fallback.
    const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    return { imagen: bmp, ancho: bmp.width, alto: bmp.height, liberar: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.src = url;
    try {
      await img.decode(); // browsers apply EXIF orientation when drawing an <img>
    } catch {
      URL.revokeObjectURL(url);
      throw new ErrorFoto("No se pudo leer la imagen. Intente con otra foto.");
    }
    return { imagen: img, ancho: img.naturalWidth, alto: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
  }
}

const aBlob = (c: HTMLCanvasElement, calidad: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", calidad));

/** Throws ErrorFoto with a Spanish message the UI shows as is. */
export async function procesarArchivo(archivo: Blob, limite = MAX_FOTO_BYTES): Promise<FotoProcesada> {
  const cabecera = new Uint8Array(await archivo.slice(0, 16).arrayBuffer());
  const rechazo = errorDeFormato(detectarFormato(cabecera));
  if (rechazo) throw new ErrorFoto(rechazo);

  const fuente = await decodificar(archivo);
  try {
    if (!fuente.ancho || !fuente.alto) throw new ErrorFoto("No se pudo leer la imagen. Intente con otra foto.");
    const canvas = document.createElement("canvas");
    let dims = dimensionesFinales(fuente.ancho, fuente.alto);
    const blob = await comprimirHasta(async (escala, calidad) => {
      dims = dimensionesFinales(fuente.ancho, fuente.alto, undefined, escala);
      canvas.width = dims.ancho;
      canvas.height = dims.alto;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#fff"; // PNG transparency would turn black in JPEG
      ctx.fillRect(0, 0, dims.ancho, dims.alto);
      ctx.drawImage(fuente.imagen, 0, 0, dims.ancho, dims.alto);
      return aBlob(canvas, calidad);
    }, limite);
    if (!blob) throw new ErrorFoto("No se pudo reducir la foto a un tamaño aceptable. Tome otra con mejor luz o más cerca del documento.");
    return { blob, ancho: dims.ancho, alto: dims.alto };
  } finally {
    fuente.liberar();
  }
}
