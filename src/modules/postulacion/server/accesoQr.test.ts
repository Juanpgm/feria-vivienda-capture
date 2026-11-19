import { describe, expect, it } from "vitest";
import { firmarAcceso, vencimiento, verificarAcceso } from "./accesoQr";

const clave = Buffer.from("clave-de-prueba");
const ahora = Date.UTC(2026, 10, 19, 15, 0, 0); // 10:00 in Bogota

describe("código de acceso del QR", () => {
  it("accepts a code of the current series before it expires", () => {
    const t = firmarAcceso(clave, 3, vencimiento(1, ahora));
    expect(verificarAcceso(clave, t, 3, ahora)).toMatchObject({ ok: true });
  });
  it("rejects an expired code (a shared photo stops working)", () => {
    const t = firmarAcceso(clave, 3, vencimiento(1, ahora));
    expect(verificarAcceso(clave, t, 3, ahora + 2 * 24 * 3600_000)).toEqual({ ok: false, motivo: "vencido" });
  });
  it("rejects a code of a voided series", () => {
    const t = firmarAcceso(clave, 3, vencimiento(7, ahora));
    expect(verificarAcceso(clave, t, 4, ahora)).toEqual({ ok: false, motivo: "anulado" });
  });
  it("rejects forged, tampered or missing codes", () => {
    const t = firmarAcceso(clave, 3, vencimiento(7, ahora));
    const [exp, v, f] = t.split(".");
    expect(verificarAcceso(clave, `${Number(exp) + 86400}.${v}.${f}`, 3, ahora)).toEqual({ ok: false, motivo: "invalido" });
    expect(verificarAcceso(Buffer.from("otra"), t, 3, ahora)).toEqual({ ok: false, motivo: "invalido" });
    expect(verificarAcceso(clave, undefined, 3, ahora)).toEqual({ ok: false, motivo: "invalido" });
  });
  it("expires at the end of the last day in Bogota", () => {
    expect(new Date(vencimiento(1, ahora) * 1000).toISOString()).toBe("2026-11-20T04:59:59.000Z"); // 19 Nov 23:59:59 Bogota
    expect(new Date(vencimiento(7, ahora) * 1000).toISOString()).toBe("2026-11-26T04:59:59.000Z");
  });
});
