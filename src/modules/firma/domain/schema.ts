import { z } from "zod";

export const METODOS_FIRMA = { dibujada: "Firma dibujada en pantalla", verificacion_manual: "Verificación manual" } as const;
export type MetodoFirma = keyof typeof METODOS_FIRMA;

export const METODOS_VERIFICACION = { firma_papel: "Firma en papel", huella: "Huella", otro: "Otro" } as const;
export type MetodoVerificacion = keyof typeof METODOS_VERIFICACION;

export const NOTA_MIN = 10;
export const NOTA_MAX = 500;

const metodoVerificacion = z.enum(Object.keys(METODOS_VERIFICACION) as [MetodoVerificacion, ...MetodoVerificacion[]], {
  error: "Elija cómo se verificó la identidad",
});
const nota = z
  .string({ error: "Escriba la nota de la verificación" })
  .trim()
  .min(NOTA_MIN, `La nota debe tener al menos ${NOTA_MIN} caracteres`)
  .max(NOTA_MAX, `La nota no puede superar ${NOTA_MAX} caracteres`);

/**
 * Signature as the server receives it. The drawn image travels apart (adjuntos endpoint, `tipo: "firma"`), so
 * `dibujada` carries no image here and `verificacion_manual` never has one. Who verified and when are server-owned.
 */
export const firmaSchema = z.discriminatedUnion(
  "metodo_firma",
  [
    z.object({ metodo_firma: z.literal("dibujada") }),
    z.object({ metodo_firma: z.literal("verificacion_manual"), metodo_verificacion: metodoVerificacion, nota_verificacion: nota }),
  ],
  { error: "Registre la firma del solicitante o una verificación manual" },
);
export type FirmaEntrada = z.output<typeof firmaSchema>;

/** Form section `firma`: the same rules plus the drawn image (data URL), which must exist for `dibujada`. */
export const firmaFormSchema = z.discriminatedUnion(
  "metodo_firma",
  [
    z.object({ metodo_firma: z.literal("dibujada"), imagen: z.string({ error: "Dibuje la firma" }).min(1, "Dibuje la firma") }),
    z.object({ metodo_firma: z.literal("verificacion_manual"), metodo_verificacion: metodoVerificacion, nota_verificacion: nota }),
  ],
  { error: "Dibuje la firma o registre una verificación manual" },
);

/** Valores iniciales de la sección `firma` del formulario. */
/** `obsoleta`: the signature was dropped because the data changed after signing (the step explains it). */
export const FIRMA_VACIA = { metodo_firma: "", imagen: "", metodo_verificacion: "", nota_verificacion: "", sello: "", obsoleta: false };

/** Form values -> what the server accepts (no image, no seal). */
export function firmaParaEnviar(f: Record<string, unknown>): Record<string, unknown> {
  return f.metodo_firma === "verificacion_manual"
    ? { metodo_firma: "verificacion_manual", metodo_verificacion: f.metodo_verificacion, nota_verificacion: f.nota_verificacion }
    : { metodo_firma: f.metodo_firma };
}

/**
 * Seal of everything the person saw before signing (all form sections but `firma`). The signature is only valid while the
 * current data produces the same seal: editing anything after signing invalidates it. FNV-1a 32-bit, not a security
 * measure (the server re-validates every submit), just a cheap change detector that survives a draft reload.
 */
export function selloDeDatos(valores: Record<string, unknown>): string {
  const { firma: _firma, ...resto } = valores; // eslint-disable-line @typescript-eslint/no-unused-vars
  // Sorted keys: the same data must give the same seal whatever object it was read from.
  const texto = JSON.stringify(resto, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** True when the stored signature still matches the current data. Manual verification has no image but is sealed too. */
export const firmaVigente = (valores: Record<string, Record<string, unknown>>): boolean =>
  !!valores.firma?.metodo_firma && valores.firma.sello === selloDeDatos(valores);
