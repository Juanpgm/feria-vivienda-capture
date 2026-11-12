import { describe, expect, it } from "vitest";
import { firmarSesion, verificarCookie } from "./cookie";

const k = Buffer.from("clave-de-prueba");
describe("cookie ciudadano", () => {
  it("round-trips", () => expect(verificarCookie(firmarSesion("123", k), k)).toBe("123"));
  it("rejects another key, tampering, expiry and junk", () => {
    const c = firmarSesion("123", k);
    expect(verificarCookie(c, Buffer.from("otra"))).toBeNull();
    const [carga, sig] = c.split(".");
    const otra = Buffer.from(JSON.stringify({ d: "999", e: Date.now() + 1e9 })).toString("base64url");
    expect(verificarCookie(`${otra}.${sig}`, k)).toBeNull();
    expect(verificarCookie(c, k, Date.now() + 9 * 3600_000)).toBeNull();
    expect(verificarCookie(undefined, k)).toBeNull();
    expect(verificarCookie(`${carga}.${sig}.x`, k)).toBeNull();
  });
});
