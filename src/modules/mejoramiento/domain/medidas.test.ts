import { describe, expect, it } from "vitest";
import { evaluarCantidad } from "./cantidad";
import { dimensionesDe, expresionMedidas } from "./medidas";

describe("dimensionesDe", () => {
  it("chooses the measurements by unit", () => {
    expect(dimensionesDe("M2")).toEqual(["largo", "ancho"]);
    expect(dimensionesDe("m3")).toEqual(["largo", "ancho", "alto"]);
    expect(dimensionesDe("M")).toEqual(["largo"]);
    expect(dimensionesDe("ML")).toEqual(["largo"]);
  });

  it("has no calculator for other units", () => {
    expect(dimensionesDe("UND")).toBeNull();
    expect(dimensionesDe("PUNTO")).toBeNull();
    expect(dimensionesDe(undefined)).toBeNull();
  });
});

describe("expresionMedidas (Calculadora de medidas)", () => {
  it("builds the memoria de cálculo with decimal comma and a discounted line", () => {
    const e = expresionMedidas("M2", [{ largo: "2", ancho: "3.5" }, { largo: "1,2", ancho: "2", descontar: true }]);
    expect(e).toBe("(2*3,5)-(1,2*2)");
    expect(evaluarCantidad(e)).toEqual({ ok: true, valor: 4.6 });
  });

  it("multiplies three measurements for M3 and adds lines", () => {
    const e = expresionMedidas("M3", [{ largo: "2", ancho: "1", alto: "0,5" }, { largo: "1", ancho: "1", alto: "1" }]);
    expect(e).toBe("(2*1*0,5)+(1*1*1)");
    expect(evaluarCantidad(e)).toEqual({ ok: true, valor: 2 });
  });

  it("uses only the length for linear units", () => {
    const e = expresionMedidas("ML", [{ largo: "3,4", ancho: "9" }, { largo: "0,4", descontar: true }]);
    expect(e).toBe("(3,4)-(0,4)");
    expect(evaluarCantidad(e)).toEqual({ ok: true, valor: 3 });
  });

  it("ignores empty, incomplete and invalid lines", () => {
    expect(expresionMedidas("M2", [{ largo: "", ancho: "" }, { largo: "2", ancho: "" }, { largo: "abc", ancho: "2" }, { largo: "0", ancho: "2" }, { largo: "2", ancho: "2" }])).toBe("(2*2)");
    expect(expresionMedidas("M2", [{ largo: "", ancho: "" }])).toBe("");
    expect(expresionMedidas("UND", [{ largo: "2" }])).toBe("");
  });
});
