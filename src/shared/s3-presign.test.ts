import { describe, expect, it } from "vitest";

// Real presigner, fake credentials: runs offline and pins the URL shape S3 will check.
process.env.AWS_ACCESS_KEY_ID = "AKIAFAKEFAKEFAKEFAKE";
process.env.AWS_SECRET_ACCESS_KEY = "fake-secret";
process.env.AWS_REGION = "us-east-1";
process.env.S3_BUCKET_NAME = "mejoramiento-vivienda";
const { firmarSubida } = await import("./s3");

describe("presigned PUT URL", () => {
  it("binds content-type and content-length and carries no empty-body checksum", async () => {
    const { url } = await firmarSubida("visitas-profesionales/MV-000001/registro-fotografico/MV-000001_290304_01.jpg", "image/jpeg", 1234);
    const u = new URL(url);
    expect(u.host).toBe("mejoramiento-vivienda.s3.us-east-1.amazonaws.com");
    expect(u.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(expect.arrayContaining(["content-length", "content-type", "host", "if-none-match"]));
    expect([...u.searchParams.keys()].filter((k) => k.toLowerCase().includes("checksum"))).toEqual([]);
  });
});
