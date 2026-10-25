import { z } from "zod";

/**
 * Draft-side marker of the identity-document step. The photos themselves live in IndexedDB (never in the form values,
 * never in the draft record); this section only says "a photo is stored", so the step validates like any other.
 */
export const FOTO_CAPTURADA = "capturada";

export const documentosSchema = z.object({
  documento_frente: z.literal(FOTO_CAPTURADA, { error: "Falta la foto del frente del documento" }),
  documento_reverso: z.literal(FOTO_CAPTURADA, { error: "Falta la foto del reverso del documento" }),
});

export type Documentos = z.output<typeof documentosSchema>;
