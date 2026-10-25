// Submit orchestration as a pure state machine (no fetch, no React): the UI injects the three server calls.
// Sequence: 1) POST /api/registros (idempotent by the draft uuid, returns the radicado), 2) upload each attachment,
// 3) ask the server to verify completeness. A failure never loses the draft and never creates a second registro:
// `ejecutarEnvio` can be called again with the previous failure and continues where it stopped.
import type { TipoAdjunto } from "@/modules/documentos/domain/imagen";

export type Archivo = TipoAdjunto;
export type Etapa = "registro" | "archivos" | "cierre";

/** Failure of one server call, already classified for the UI. */
export class ErrorEnvio extends Error {
  constructor(
    message: string,
    readonly opciones: { status?: number; sinConexion?: boolean; campos?: Record<string, string[]> } = {},
  ) {
    super(message);
  }
}

export type ResultadoCreacion = { id: string; radicado: string; registrado_en: string | null; advertencias?: unknown[] };

export type EstadoEnvio =
  | { fase: "inactivo" }
  | { fase: "enviando"; etapa: Etapa; radicado?: string; subiendo?: Archivo; subidos: Archivo[] }
  | {
      fase: "error";
      etapa: Etapa;
      mensaje: string;
      radicado?: string;
      /** Result of the create call, kept so a retry can finish without asking the server again. */
      creado?: ResultadoCreacion;
      subidos: Archivo[];
      /** Attachments that failed (etapa "archivos"). */
      fallidos: Archivo[];
      sinConexion: boolean;
      conflicto: boolean;
    }
  | { fase: "listo"; radicado: string; id: string; registrado_en: string | null; advertencias: unknown[] };

export type DepsEnvio = {
  /** The registro id (the draft uuid). */
  id: string;
  /** Attachments this submit must upload (both photos, plus the signature image when it was drawn). */
  archivos: readonly Archivo[];
  crear: () => Promise<ResultadoCreacion>;
  subir: (a: Archivo) => Promise<void>;
  completar: () => Promise<{ completo: boolean; faltan: Archivo[] }>;
};

/** What a retry needs from the previous failure. */
export type Progreso = { radicado?: string; subidos: readonly Archivo[]; resultado?: ResultadoCreacion };

export const progresoDe = (e: EstadoEnvio): Progreso =>
  e.fase === "error" ? { radicado: e.radicado, subidos: e.subidos, resultado: e.creado } : { subidos: [] };

export const ETIQUETA_ARCHIVO: Record<Archivo, string> = {
  documento_frente: "Foto del frente del documento",
  documento_reverso: "Foto del reverso del documento",
  firma: "Imagen de la firma",
};

function mensajeDe(e: unknown, defecto: string): { mensaje: string; sinConexion: boolean; conflicto: boolean } {
  if (e instanceof ErrorEnvio) {
    return { mensaje: e.message, sinConexion: !!e.opciones.sinConexion, conflicto: e.opciones.status === 409 };
  }
  return { mensaje: defecto, sinConexion: false, conflicto: false };
}

/**
 * Runs (or resumes) a submit. Never throws: always resolves to the resulting state ("listo" or "error").
 * `alCambiar` receives each intermediate state so the UI can announce progress.
 */
export async function ejecutarEnvio(deps: DepsEnvio, previo: Progreso = { subidos: [] }, alCambiar: (e: EstadoEnvio) => void = () => {}): Promise<EstadoEnvio> {
  let radicado = previo.radicado;
  let resultado = previo.resultado;
  const subidos = new Set<Archivo>(previo.subidos.filter((a) => deps.archivos.includes(a)));
  const fallo = (etapa: Etapa, e: unknown, defecto: string, fallidos: Archivo[] = []): EstadoEnvio => {
    const m = mensajeDe(e, defecto);
    return { fase: "error", etapa, radicado, creado: resultado, subidos: [...subidos], fallidos, ...m };
  };

  // 1) Create (skipped on retry: the radicado already exists and must not be asked for again).
  if (!radicado) {
    alCambiar({ fase: "enviando", etapa: "registro", subidos: [] });
    try {
      resultado = await deps.crear();
      radicado = resultado.radicado;
    } catch (e) {
      return fallo("registro", e, "No se pudo crear el registro");
    }
  }

  // 2) Attachments: try every pending one so the person sees ALL that failed, not just the first.
  const fallidos: Archivo[] = [];
  const errores = new Map<Archivo, unknown>();
  for (const a of deps.archivos) {
    if (subidos.has(a)) continue;
    alCambiar({ fase: "enviando", etapa: "archivos", radicado, subiendo: a, subidos: [...subidos] });
    try {
      await deps.subir(a);
      subidos.add(a);
    } catch (e) {
      fallidos.push(a);
      errores.set(a, e);
    }
  }
  if (fallidos.length) return fallo("archivos", errores.get(fallidos[0]), "No se pudo subir el archivo", fallidos);

  // 3) The server verifies that everything it needs is really there.
  alCambiar({ fase: "enviando", etapa: "cierre", radicado, subidos: [...subidos] });
  try {
    const c = await deps.completar();
    if (!c.completo) {
      for (const a of c.faltan) subidos.delete(a);
      return fallo("archivos", new ErrorEnvio("El servidor no recibió todos los archivos"), "", c.faltan);
    }
  } catch (e) {
    return fallo("cierre", e, "No se pudo confirmar el registro");
  }
  return {
    fase: "listo",
    radicado,
    id: deps.id,
    registrado_en: resultado?.registrado_en ?? null,
    advertencias: resultado?.advertencias ?? [],
  };
}
