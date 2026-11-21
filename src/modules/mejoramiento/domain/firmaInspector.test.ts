import { describe, expect, it } from "vitest";
import { decodificarFirmaPng, FIRMA_MAX_BYTES } from "./firmaInspector";

const png = (extra = 10) => `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(extra).fill(1)]).toString("base64")}`;

describe("decodificarFirmaPng", () => {
  it("accepts a real PNG data URL", () => {
    const r = decodificarFirmaPng(png());
    expect(r.ok && r.bytes.length).toBe(18);
  });
  it("rejects other types, fake PNGs and oversized images", () => {
    expect(decodificarFirmaPng("data:image/webp;base64,AAAA")).toEqual({ ok: false, error: "La firma debe ser una imagen PNG" });
    expect(decodificarFirmaPng(`data:image/png;base64,${Buffer.from("<svg onload=x>").toString("base64")}`)).toEqual({ ok: false, error: "La firma debe ser una imagen PNG" });
    expect(decodificarFirmaPng(png(FIRMA_MAX_BYTES))).toEqual({ ok: false, error: "La firma es demasiado pesada" });
    expect(decodificarFirmaPng(42)).toMatchObject({ ok: false });
  });
});
