import { describe, expect, it, vi } from "vitest";
import { conReintentos, ErrorSubida } from "./subirAdjuntos";

describe("conReintentos", () => {
  it("retries retryable failures with exponential backoff and then succeeds", async () => {
    const esperas: number[] = [];
    let n = 0;
    const r = await conReintentos(
      async () => {
        if (++n < 3) throw new ErrorSubida("sin conexión", true);
        return "ok";
      },
      { baseMs: 100, esperar: async (ms) => void esperas.push(ms) },
    );
    expect(r).toEqual({ valor: "ok", intentos: 3 });
    expect(esperas).toEqual([100, 200]);
  });

  it("gives up after the attempt limit with the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new ErrorSubida("caído", true));
    const r = await conReintentos(fn, { intentos: 3, esperar: async () => undefined });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ intentos: 3, error: { message: "caído" } });
  });

  it("does not retry definitive rejections", async () => {
    const fn = vi.fn().mockRejectedValue(new ErrorSubida("no es una imagen", false));
    const r = await conReintentos(fn, { esperar: async () => undefined });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ intentos: 1, error: { message: "no es una imagen" } });
  });
});
