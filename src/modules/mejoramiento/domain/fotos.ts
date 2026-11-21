// File rules and S3 key layout of a visit. Keys are built ONLY here (server side), never taken from the client.
//   visitas-profesionales/{codigo}/registro-fotografico/{codigo}_{ITEM}_{nn}.{ext}
//   visitas-profesionales/{codigo}/firma-ciudadano/{codigo}_{documento}_01.png
//   visitas-profesionales/{codigo}/croquis-visita/{codigo}_{nn}.{ext}
//   inspectores/{uid}/firma.png
import { normalizarDocumento } from "@/shared/normalizacion/texto";

export const MIN_FOTOS_VISITA = 6;
export const MAX_FOTOS_VISITA = 30;
export const MAX_FOTOS_ITEM = 6;
export const MAX_CROQUIS = 4;
/** Upper bound per uploaded file (photos are compressed client side well below this). */
export const MAX_BYTES_ARCHIVO = 8 * 1024 * 1024;

export const CARPETA_VISITAS = "visitas-profesionales";
export const CARPETAS = { fotos: "registro-fotografico", firma: "firma-ciudadano", croquis: "croquis-visita" } as const;

const EXTENSIONES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export const TIPOS_CROQUIS = [...TIPOS_FOTO, "application/pdf"] as const;

export const extensionDe = (tipo: string): string | null => EXTENSIONES[tipo] ?? null;

const pad2 = (n: number) => String(n).padStart(2, "0");
/** ITEM codes such as "APU 01" become "APU-01" so keys have no spaces. */
const segmento = (s: string) => s.replace(/[^A-Za-z0-9-]+/g, "-");

/** Base names per row; the consecutive restarts per ITEM and continues across repeated rows of the same ITEM. */
export function nombresFotos(codigo: string, filas: { item: string; fotos: number }[]): string[][] {
  const usados = new Map<string, number>();
  return filas.map(({ item, fotos }) =>
    Array.from({ length: fotos }, () => {
      const n = (usados.get(item) ?? 0) + 1;
      usados.set(item, n);
      return `${codigo}_${segmento(item)}_${pad2(n)}`;
    }),
  );
}

const enVisita = (codigo: string, carpeta: string, nombre: string) => `${CARPETA_VISITAS}/${codigo}/${carpeta}/${nombre}`;

export const claveFoto = (codigo: string, nombre: string, tipo: string) => enVisita(codigo, CARPETAS.fotos, `${nombre}.${extensionDe(tipo)}`);

/** Only one citizen signature per visit: always consecutive 01. */
export const claveFirmaCiudadano = (codigo: string, documento: string) =>
  enVisita(codigo, CARPETAS.firma, `${codigo}_${normalizarDocumento(documento)}_01.png`);

export const claveCroquis = (codigo: string, n: number, tipo: string) => enVisita(codigo, CARPETAS.croquis, `${codigo}_${pad2(n)}.${extensionDe(tipo)}`);

/** Firebase uids are [A-Za-z0-9]; anything else is replaced so a uid can never change the folder layout. */
export const claveFirmaInspector = (uid: string) => `inspectores/${uid.replace(/[^A-Za-z0-9_-]/g, "-")}/firma.png`;

/** `conteos` = photos per quantity row. A visit that does not apply has no rows and needs no photos. */
export function erroresFotos(conteos: number[], aplica: boolean): string[] {
  const errores = conteos.flatMap((n, i) => (n > MAX_FOTOS_ITEM ? [`Máximo ${MAX_FOTOS_ITEM} fotos por actividad (fila ${i + 1} tiene ${n})`] : []));
  if (!aplica) return errores;
  const total = conteos.reduce((s, n) => s + n, 0);
  if (total < MIN_FOTOS_VISITA) errores.push(`Se requieren al menos ${MIN_FOTOS_VISITA} fotos por visita (hay ${total})`);
  if (total > MAX_FOTOS_VISITA) errores.push(`Máximo ${MAX_FOTOS_VISITA} fotos por visita (hay ${total})`);
  return errores;
}
