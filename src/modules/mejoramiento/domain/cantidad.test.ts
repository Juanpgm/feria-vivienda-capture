import { describe, expect, it } from "vitest";
import { evaluarCantidad } from "./cantidad";

describe("evaluarCantidad (memoria de cálculo)", () => {
  it("evaluates the measurement formulas used in PRESUPUESTO TOPOP", () => {
    expect(evaluarCantidad("=((1.87+3.4)*(2.7+4.6))*2-1.432")).toEqual({ ok: true, valor: 75.510 });
    expect(evaluarCantidad("12.5")).toEqual({ ok: true, valor: 12.5 });
    expect(evaluarCantidad("3x2.4")).toEqual({ ok: true, valor: 7.2 });
  });

  it("accepts the Colombian decimal comma and spaces", () => {
    expect(evaluarCantidad(" 2,5 * 4 ")).toEqual({ ok: true, valor: 10 });
    expect(evaluarCantidad("(1,2 + 0,3) / 3")).toEqual({ ok: true, valor: 0.5 });
  });

  it("respects precedence and unary minus, rounding to 4 decimals", () => {
    expect(evaluarCantidad("2+3*4")).toEqual({ ok: true, valor: 14 });
    expect(evaluarCantidad("10-(-2)")).toEqual({ ok: true, valor: 12 });
    expect(evaluarCantidad("1/3")).toEqual({ ok: true, valor: 0.3333 });
  });

  it("rejects empty, malformed, unsafe and non-positive input with a readable message", () => {
    for (const mala of ["", "  ", "2+", "(2", "2)", "abc", "2**3", "alert(1)", "1..2", "1,2,3"]) {
      expect(evaluarCantidad(mala).ok, mala).toBe(false);
    }
    expect(evaluarCantidad("1/0")).toEqual({ ok: false, error: "La operación no da un número válido" });
    expect(evaluarCantidad("2-2")).toEqual({ ok: false, error: "La cantidad debe ser mayor que cero" });
    expect(evaluarCantidad("2000000")).toEqual({ ok: false, error: "La cantidad es demasiado grande" });
    expect(evaluarCantidad("2+")).toEqual({ ok: false, error: "Revise la operación: 2+" });
  });
});
