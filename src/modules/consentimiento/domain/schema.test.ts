import { describe, expect, it } from "vitest";
import { CONDICION_NO_AUTORIZADO, consentimientoSchema, proteccionAutorizada } from "./schema";
import { CONSENTIMIENTO_VERSION, POLITICA_URL, SECCIONES_TEXTO, textoPlano } from "./texto";
import { hashConsentimiento } from "../server/hash";

const ok = { acepta_tratamiento: true, acepta_datos_sensibles: false, version: CONSENTIMIENTO_VERSION };
const campos = (v: unknown) => {
  const r = consentimientoSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("consentimientoSchema", () => {
  it("accepts the treatment with or without the optional sensitive data authorization", () => {
    expect(consentimientoSchema.parse(ok)).toEqual(ok);
    expect(consentimientoSchema.parse({ ...ok, acepta_datos_sensibles: true }).acepta_datos_sensibles).toBe(true);
  });

  it("requires the treatment authorization: unticked, missing or non-boolean fail on that field", () => {
    expect(campos({ ...ok, acepta_tratamiento: false })).toEqual(["acepta_tratamiento"]);
    expect(campos({ acepta_datos_sensibles: true, version: CONSENTIMIENTO_VERSION })).toEqual(["acepta_tratamiento"]);
    expect(campos({ ...ok, acepta_tratamiento: "true" })).toEqual(["acepta_tratamiento"]);
    expect(campos(undefined)).toHaveLength(1);
  });

  it("refuses an authorization given on another wording version", () => {
    expect(campos({ ...ok, version: "2020-01-v1" })).toEqual(["acepta_tratamiento"]);
    expect(campos({ acepta_tratamiento: true, acepta_datos_sensibles: false })).toEqual(["acepta_tratamiento"]);
  });

  it("the sensitive answer must be a boolean (declining is false, never missing)", () => {
    expect(campos({ acepta_tratamiento: true, version: CONSENTIMIENTO_VERSION })).toEqual(["acepta_datos_sensibles"]);
  });

  it("drops any extra field the client sends (hash, timestamps)", () => {
    expect(consentimientoSchema.parse({ ...ok, hash: "x", aceptado_en: "2000-01-01" })).toEqual(ok);
  });
});

describe("proteccionAutorizada (sensitive data stripping)", () => {
  it("keeps the selection when authorized", () => {
    expect(proteccionAutorizada(["discapacidad", "mujer_vbg"], true)).toEqual(["discapacidad", "mujer_vbg"]);
    expect(proteccionAutorizada(["ninguna"], true)).toEqual(["ninguna"]);
  });

  it("stores only no_autorizado when refused, whatever was selected, without mutating the input", () => {
    const entrada = ["discapacidad", "victima_conflicto"];
    expect(proteccionAutorizada(entrada, false)).toEqual([CONDICION_NO_AUTORIZADO]);
    expect(proteccionAutorizada(["ninguna"], false)).toEqual([CONDICION_NO_AUTORIZADO]);
    expect(entrada).toEqual(["discapacidad", "victima_conflicto"]);
  });
});

describe("texto y hash", () => {
  it("the version is a dated tag and the text covers the Ley 1581 essentials", () => {
    expect(CONSENTIMIENTO_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
    const t = textoPlano();
    for (const palabra of ["Secretaría de Vivienda Social y Hábitat", "RUD", "centrales de riesgo", "Superintendencia de Industria y Comercio", "revocar", "sensibles"]) {
      expect(t).toContain(palabra);
    }
    expect(SECCIONES_TEXTO.length).toBeGreaterThanOrEqual(5);
    expect(POLITICA_URL).toMatch(/^https:\/\/www\.cali\.gov\.co\//);
  });

  it("the hash is a stable sha256 of version + text", () => {
    expect(hashConsentimiento()).toMatch(/^[0-9a-f]{64}$/);
    expect(hashConsentimiento()).toBe(hashConsentimiento());
  });
});
