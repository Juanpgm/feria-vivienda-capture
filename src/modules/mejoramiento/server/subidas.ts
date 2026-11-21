import { borrarObjeto, firmarSubida, verificarObjeto } from "@/shared/s3";

type Archivo = { ref: string; key: string; content_type: string; bytes: number };

/**
 * Presigned create-only PUTs for the files still to upload. With `revisar` (a retry, or a croquis restart) each
 * server-chosen key is checked first: an object that already matches is skipped; one left by an earlier attempt
 * with other content is deleted, so the create-only PUT of the corrected file can land.
 */
// ponytail: "matches" = same size and type (HeadObject), not a content hash; a same-size replacement is skipped.
export async function firmarPendientes(archivos: Archivo[], revisar: boolean) {
  const firmadas = await Promise.all(
    archivos.map(async (a) => {
      if (revisar) {
        const o = await verificarObjeto(a.key);
        if (o && o.bytes === a.bytes && o.content_type === a.content_type) return null;
        if (o) await borrarObjeto(a.key);
      }
      return { ref: a.ref, ...(await firmarSubida(a.key, a.content_type, a.bytes)) };
    }),
  );
  return firmadas.filter((s) => s !== null);
}
