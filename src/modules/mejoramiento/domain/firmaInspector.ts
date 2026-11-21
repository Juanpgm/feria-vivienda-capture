// Validation of the inspector's handwritten signature (PNG data URL from the signature pad).
export const FIRMA_MAX_BYTES = 200 * 1024;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decoded PNG bytes, or an error message. Checks the data URL prefix, the PNG magic bytes and the size. */
export function decodificarFirmaPng(dataUrl: unknown): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  const m = typeof dataUrl === "string" ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) return { ok: false, error: "La firma debe ser una imagen PNG" };
  const bytes = new Uint8Array(Buffer.from(m[1], "base64"));
  if (bytes.length > FIRMA_MAX_BYTES) return { ok: false, error: "La firma es demasiado pesada" };
  if (bytes.length < PNG.length || PNG.some((b, i) => bytes[i] !== b)) return { ok: false, error: "La firma debe ser una imagen PNG" };
  return { ok: true, bytes };
}
