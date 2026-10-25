// Browser side of the submit: the three server calls the state machine (domain/envio.ts) is given.
import { cargarFoto } from "@/modules/documentos/ui/fotos";
import { conReintentos, enviarAdjunto, ErrorSubida } from "@/modules/documentos/ui/subirAdjuntos";
import { firmaParaEnviar } from "@/modules/firma/domain/schema";
import { ErrorEnvio, type Archivo, type ResultadoCreacion } from "../domain/envio";
import { entradaDeSeccion, type Valores } from "./pasos";

/** The JSON the server validates again (the same zod schema). Images are NOT part of it. */
export function armarEntrada(id: string, valores: Valores): Record<string, unknown> {
  return {
    id,
    solicitante: entradaDeSeccion("solicitante", valores),
    composicion: entradaDeSeccion("composicion", valores),
    inmueble: entradaDeSeccion("inmueble", valores),
    riesgo: entradaDeSeccion("riesgo", valores),
    titularidad: entradaDeSeccion("titularidad", valores),
    cierre_financiero: entradaDeSeccion("cierre_financiero", valores),
    consentimiento: entradaDeSeccion("consentimiento", valores),
    firma: firmaParaEnviar(valores.firma ?? {}),
  };
}

const MENSAJE_RED = "No hay conexión con el servidor. Revise la conexión a internet; el borrador se conserva.";

async function llamar(url: string, cuerpo?: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorEnvio(MENSAJE_RED, { sinConexion: true });
  }
}

async function errorDe(res: Response, defecto: string): Promise<ErrorEnvio> {
  const j = await res.json().catch(() => ({}));
  const base = typeof j?.error === "string" ? j.error : defecto;
  const mensaje =
    res.status === 401 ? "Su sesión venció. Inicie sesión de nuevo; el borrador se conserva."
    : res.status === 403 ? "Su cuenta no tiene permiso para registrar."
    : res.status >= 500 ? "El servidor tuvo un problema. Intente de nuevo en un momento."
    : base;
  return new ErrorEnvio(mensaje, { status: res.status, campos: j?.campos });
}

/** POST /api/registros: 201 created, 200 already created by this funcionario (same radicado). */
export async function crearEnServidor(entrada: unknown): Promise<ResultadoCreacion> {
  const res = await llamar("/api/registros", entrada);
  if (!res.ok) throw await errorDe(res, "No se pudo crear el registro");
  return res.json();
}

/** POST /api/registros/{id}/completar: the server checks which required attachments exist. */
export async function completarEnServidor(id: string): Promise<{ completo: boolean; faltan: Archivo[] }> {
  const res = await llamar(`/api/registros/${encodeURIComponent(id)}/completar`);
  if (!res.ok) throw await errorDe(res, "No se pudo confirmar el registro");
  const j = await res.json();
  return { completo: !!j.completo, faltan: Array.isArray(j.faltan) ? j.faltan : [] };
}

/** data URL -> Blob without `fetch` (the app CSP does not allow fetching data: URLs). */
export function dataUrlABlob(dataUrl: string): Blob {
  const coma = dataUrl.indexOf(",");
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "application/octet-stream";
  const binario = atob(dataUrl.slice(coma + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Uploads one attachment (photo from IndexedDB, or the drawn signature held in the form) with a few retries. */
export async function subirArchivo(id: string, archivo: Archivo, valores: Valores): Promise<void> {
  let imagen: Blob | undefined;
  if (archivo === "firma") {
    const url = valores.firma?.imagen;
    imagen = typeof url === "string" && url ? dataUrlABlob(url) : undefined;
  } else {
    imagen = (await cargarFoto(id, archivo).catch(() => undefined))?.blob;
  }
  if (!imagen) throw new ErrorEnvio(archivo === "firma" ? "La firma no está guardada en este equipo" : "La foto no está guardada en este equipo");
  const r = await conReintentos(() => enviarAdjunto(id, archivo, imagen), { intentos: 3, baseMs: 500 });
  if ("error" in r) {
    const e = r.error;
    throw new ErrorEnvio(e.message, { sinConexion: e instanceof ErrorSubida && e.message.startsWith("No hay conexión") });
  }
}
