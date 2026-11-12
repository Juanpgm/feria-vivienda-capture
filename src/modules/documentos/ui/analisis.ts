// Browser side of the photo checks: decode to a small canvas and hand the pixels to the pure checks.
import { ANCHO_ANALISIS, evaluarCedula, huella, metricas, MISMA_FOTO_MAX, distanciaHuella, type Pixeles, type ResultadoCalidad } from "../domain/calidadFoto";

async function leerPixeles(blob: Blob): Promise<{ pixeles: Pixeles; ancho: number; alto: number }> {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const ancho = Math.min(ANCHO_ANALISIS, bmp.width);
    const alto = Math.max(1, Math.round((bmp.height * ancho) / bmp.width));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("sin canvas");
    ctx.drawImage(bmp, 0, 0, ancho, alto);
    return { pixeles: ctx.getImageData(0, 0, ancho, alto), ancho: bmp.width, alto: bmp.height };
  } finally {
    bmp.close();
  }
}

/** Does it look like a document photo? An image that cannot even be analyzed is rejected too. */
export async function revisarFoto(blob: Blob): Promise<ResultadoCalidad> {
  try {
    const { pixeles, ancho, alto } = await leerPixeles(blob);
    return evaluarCedula(metricas(pixeles), ancho, alto);
  } catch {
    return { ok: false, mensaje: "No se pudo revisar la imagen. Tome la foto de nuevo con la cámara." };
  }
}

/** True when both photos are (almost) the same picture: the same side was provided for front and back. */
export async function sonLaMismaFoto(a: Blob, b: Blob): Promise<boolean> {
  try {
    const [x, y] = await Promise.all([leerPixeles(a), leerPixeles(b)]);
    return distanciaHuella(huella(x.pixeles), huella(y.pixeles)) <= MISMA_FOTO_MAX;
  } catch {
    return false;
  }
}
