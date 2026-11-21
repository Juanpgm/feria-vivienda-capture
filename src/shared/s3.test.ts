import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignedUrl = vi.fn(async (_c: unknown, cmd: { input: unknown }, o: unknown) => `https://firmada?${JSON.stringify({ input: cmd.input, o })}`);
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: (...a: [unknown, { input: unknown }, unknown]) => getSignedUrl(...a) }));
const send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (orig) => {
  const real = await orig<typeof import("@aws-sdk/client-s3")>();
  return { ...real, S3Client: class { send = send; } };
});

import { firmarSubida, verificarObjeto } from "./s3";

describe("s3 helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET_NAME = "mejoramiento-vivienda";
  });

  it("signs a PUT bound to key, content type and exact size for 15 minutes", async () => {
    const r = await firmarSubida("visitas-profesionales/MV-000001/registro-fotografico/a.jpg", "image/jpeg", 1234);
    const [, cmd, opciones] = getSignedUrl.mock.calls[0] as unknown as [unknown, { input: Record<string, unknown> }, { expiresIn: number; signableHeaders: Set<string> }];
    expect(cmd.input).toEqual({ Bucket: "mejoramiento-vivienda", Key: "visitas-profesionales/MV-000001/registro-fotografico/a.jpg", ContentType: "image/jpeg", ContentLength: 1234, IfNoneMatch: "*" });
    expect(opciones.expiresIn).toBe(900);
    expect([...opciones.signableHeaders]).toEqual(["content-type", "content-length", "if-none-match"]);
    expect(r.headers).toEqual({ "Content-Type": "image/jpeg", "If-None-Match": "*" }); // create-only: no overwrite
  });

  it("HeadObject: size/type when present, null when missing (404 or 403), rethrows other errors", async () => {
    send.mockResolvedValueOnce({ ContentLength: 10, ContentType: "image/png" });
    expect(await verificarObjeto("k")).toEqual({ bytes: 10, content_type: "image/png" });
    send.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NotFound", $metadata: { httpStatusCode: 404 } }));
    expect(await verificarObjeto("k")).toBeNull();
    send.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { $metadata: { httpStatusCode: 403 } }));
    expect(await verificarObjeto("k")).toBeNull(); // no s3:ListBucket: a missing key answers 403
    send.mockRejectedValueOnce(Object.assign(new Error("boom"), { $metadata: { httpStatusCode: 500 } }));
    await expect(verificarObjeto("k")).rejects.toThrow("boom");
  });

  it("fails loudly without a bucket", async () => {
    delete process.env.S3_BUCKET_NAME;
    await expect(firmarSubida("k", "image/png", 1)).rejects.toThrow("Falta S3_BUCKET_NAME");
  });
});
