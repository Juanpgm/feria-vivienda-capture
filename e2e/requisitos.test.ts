// Unit check (vitest): the send requirements and the submit payload, driven by the e2e datasets.
import { describe, expect, it } from "vitest";
import { selloDeDatos } from "@/modules/firma/domain/schema";
import { registroSchema } from "@/modules/registro/domain/schema";
import { armarEntrada } from "@/modules/registro/ui/enviarApi";
import type { Valores } from "@/modules/registro/ui/pasos";
import { calcularRequisitos } from "@/modules/registro/ui/requisitos";
import { fechaBogota } from "@/shared/tiempo";
import { aValores, generarCasos } from "./datos-prueba";

const caso = generarCasos(fechaBogota())[0];
const base = () => {
  return aValores(caso) as unknown as Valores;
};
const firmado = (v: Valores): Valores => ({ ...v, firma: { ...v.firma, sello: selloDeDatos(v) } });
const pendientes = async (v: Valores) => (await calcularRequisitos(v)).items.filter((i) => !i.ok).map((i) => i.id);

describe("calcularRequisitos", () => {
  it("everything done and signed: ready to send", async () => {
    const r = await calcularRequisitos(firmado(base()));
    expect(r.listo).toBe(true);
    expect(r.items.map((i) => i.id)).toEqual(["datos", "consentimiento", "documentos", "firma"]);
  });

  it("before signing only the signature is pending, and the summary does not point to a step for it", async () => {
    expect(await pendientes(base())).toEqual(["firma"]);
  });

  it("missing consent, photos or data each block, naming the step that fixes it", async () => {
    const v = base();
    v.consentimiento = { ...v.consentimiento, acepta_tratamiento: false };
    v.documentos = { documento_frente: "capturada", documento_reverso: "" };
    v.inmueble = { ...v.inmueble, direccion: "" };
    const r = await calcularRequisitos(firmado(v));
    expect(r.listo).toBe(false);
    expect(r.items.filter((i) => !i.ok).map((i) => [i.id, i.paso, i.ancla])).toEqual([["datos", "vivienda", "seccion-inmueble"], ["consentimiento", "autorizacion", "seccion-consentimiento"], ["documentos", "autorizacion", "seccion-documentos"]]);
  });

  it("consent given on an outdated wording does not count", async () => {
    const v = base();
    v.consentimiento = { ...v.consentimiento, version: "2020-01-v1" };
    expect(await pendientes(v)).toContain("consentimiento");
  });

  it("editing any data after signing invalidates the signature", async () => {
    const v = firmado(base());
    expect(await pendientes(v)).toEqual([]);
    v.inmueble = { ...v.inmueble, direccion: "Carrera 99 # 1-1" };
    expect(await pendientes(v)).toEqual(["firma"]);
  });

  it("a manual verification counts only with method and note", async () => {
    const v = base();
    v.firma = { metodo_firma: "verificacion_manual", imagen: "", metodo_verificacion: "huella", nota_verificacion: "Huella en la planilla 7", sello: "" };
    expect(await pendientes(firmado(v))).toEqual([]);
    v.firma = { ...v.firma, nota_verificacion: "corta" };
    expect(await pendientes(firmado(v))).toEqual(["firma"]);
  });
});

describe("armarEntrada", () => {
  it("builds a payload the server schema accepts, without any image or seal", () => {
    const v = firmado(base());
    const entrada = armarEntrada("6f1f6c0e-8a3b-4c52-9d77-3b1c2f5e9a10", v);
    const r = registroSchema.safeParse(entrada);
    expect(r.success).toBe(true);
    expect(JSON.stringify(entrada)).not.toContain("data:image");
    expect(entrada.firma).toEqual({ metodo_firma: "dibujada" });
  });

  it("refusing sensitive data yields no_autorizado in the parsed record", () => {
    const v = firmado(base());
    v.composicion = { ...v.composicion, condiciones_especiales: ["discapacidad"] };
    v.consentimiento = { ...v.consentimiento, acepta_datos_sensibles: false };
    const r = registroSchema.parse(armarEntrada("6f1f6c0e-8a3b-4c52-9d77-3b1c2f5e9a10", v));
    expect(r.composicion.condiciones_especiales).toEqual(["no_autorizado"]);
  });
});
