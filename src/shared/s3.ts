// S3 access for visit files (bucket S3_BUCKET_NAME, private: Block all public access). Server only.
// Credentials come from the AWS SDK default chain: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY on Vercel, or
// AWS_PROFILE=mejoramiento-vivienda locally. The browser only ever receives short-lived presigned URLs.
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const SUBIDA_SEGUNDOS = 15 * 60;
export const LECTURA_SEGUNDOS = 10 * 60;

let cliente: S3Client | null = null;
const s3 = () => (cliente ??= new S3Client({ region: process.env.AWS_REGION }));

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
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: bytes });
  const url = await getSignedUrl(s3(), cmd, { expiresIn: SUBIDA_SEGUNDOS, signableHeaders: new Set(["content-type", "content-length"]) });
  return { url, headers: { "Content-Type": contentType } };
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
    if (status === 404 || (e as Error).name === "NotFound") return null;
    throw e;
  }
}
