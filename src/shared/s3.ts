// S3 access for visit files (bucket S3_BUCKET_NAME, private: Block all public access). Server only.
// Credentials come from the AWS SDK default chain: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY on Vercel, or
// AWS_PROFILE=mejoramiento-vivienda locally. The browser only ever receives short-lived presigned URLs.
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const SUBIDA_SEGUNDOS = 15 * 60;
export const LECTURA_SEGUNDOS = 10 * 60;

let cliente: S3Client | null = null;
// WHEN_REQUIRED: by default the SDK adds a CRC32 of the (empty) presign-time body to PUT URLs, and S3 would then
// reject every real upload with BadDigest.
const s3 = () => (cliente ??= new S3Client({ region: process.env.AWS_REGION, requestChecksumCalculation: "WHEN_REQUIRED" }));

export function bucket(): string {
  const b = process.env.S3_BUCKET_NAME;
  if (!b) throw new Error("Falta S3_BUCKET_NAME");
  return b;
}

/**
 * Presigned PUT bound to one server-chosen key, its content type and its exact size (both are signed, so the
 * browser cannot upload a different type or a bigger file under that URL).
 */
export async function firmarSubida(key: string, contentType: string, bytes: number) {
  // If-None-Match: * (signed) makes the write create-only: once a file is stored, no URL can overwrite it. A retry of
  // an upload that already landed answers 412, which the client treats as "already there".
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: bytes, IfNoneMatch: "*" });
  const url = await getSignedUrl(s3(), cmd, { expiresIn: SUBIDA_SEGUNDOS, signableHeaders: new Set(["content-type", "content-length", "if-none-match"]) });
  return { url, headers: { "Content-Type": contentType, "If-None-Match": "*" } };
}

/** Server-side upload for small files the server already validated (the inspector's signature). */
export async function guardarObjeto(key: string, cuerpo: Uint8Array, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: cuerpo, ContentType: contentType }));
}

/** Removes an object; only ever called on server-chosen keys of a visit that is not confirmed yet. */
export async function borrarObjeto(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Presigned GET to show a stored file (inline). */
export const firmarLectura = (key: string) =>
  getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: LECTURA_SEGUNDOS });

/** Size and type of an uploaded object, or null when it is not there (yet). */
export async function verificarObjeto(key: string): Promise<{ bytes: number; content_type: string } | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { bytes: r.ContentLength ?? 0, content_type: r.ContentType ?? "" };
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    // Without s3:ListBucket, S3 answers 403 (not 404) for a key that does not exist yet.
    if (status === 404 || status === 403 || (e as Error).name === "NotFound") return null;
    throw e;
  }
}
