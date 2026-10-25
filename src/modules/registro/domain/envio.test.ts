import { describe, expect, it, vi } from "vitest";
import { enmascararDocumento } from "./enmascarar";
import { ejecutarEnvio, ErrorEnvio, progresoDe, type Archivo, type DepsEnvio, type EstadoEnvio } from "./envio";

const TODOS: Archivo[] = ["documento_frente", "documento_reverso", "firma"];
const creado = { id: "id-1", radicado: "FV-000123", registrado_en: "2026-03-05T20:42:00.000Z", advertencias: [] };

/** Server double: remembers the radicado per id (idempotent create) and which files fail. */
function servidor(opciones: { fallan?: Archivo[]; redCaida?: boolean; faltan?: Archivo[] } = {}) {
  const f = { crear: 0, subidas: [] as Archivo[], completar: 0, fallan: new Set(opciones.fallan), redCaida: !!opciones.redCaida, faltan: opciones.faltan ?? [] };
  const deps: DepsEnvio = {
    id: "id-1",
    archivos: TODOS,
    crear: async () => {
      f.crear++;
      if (f.redCaida) throw new ErrorEnvio("No hay conexión con el servidor", { sinConexion: true });
      return creado;
    },
    subir: async (a) => {
      f.subidas.push(a);
      if (f.fallan.has(a)) throw new ErrorEnvio("Error 500");
    },
    completar: async () => ({ completo: f.faltan.length === 0, faltan: f.faltan }),
  };
  return { f, deps };
}

describe("ejecutarEnvio", () => {
  it("happy path: create, upload the three files in order, verify, done with the radicado", async () => {
    const { f, deps } = servidor();
    const estados: string[] = [];
    const fin = await ejecutarEnvio(deps, undefined, (e) => estados.push(e.fase === "enviando" ? `${e.etapa}${e.subiendo ? `:${e.subiendo}` : ""}` : e.fase));
    expect(fin).toEqual({ fase: "listo", radicado: "FV-000123", id: "id-1", registrado_en: creado.registrado_en, advertencias: [] });
    expect(f.subidas).toEqual(TODOS);
    expect(estados).toEqual(["registro", "archivos:documento_frente", "archivos:documento_reverso", "archivos:firma", "cierre"]);
  });

  it("a failed upload keeps the registro, names EVERY failed file and still tries the others", async () => {
    const { f, deps } = servidor({ fallan: ["documento_reverso", "firma"] });
    const fin = await ejecutarEnvio(deps);
    expect(fin).toMatchObject({ fase: "error", etapa: "archivos", radicado: "FV-000123", fallidos: ["documento_reverso", "firma"], subidos: ["documento_frente"] });
    expect(f.subidas).toEqual(TODOS);
    expect(f.completar).toBe(0);
  });

  it("retry reuses the radicado: no second create, only the failed files are uploaded again", async () => {
    const { f, deps } = servidor({ fallan: ["firma"] });
    const primero = await ejecutarEnvio(deps);
    expect(primero.fase).toBe("error");
    f.fallan.clear();
    f.subidas.length = 0;
    const fin = await ejecutarEnvio(deps, progresoDe(primero));
    expect(fin).toMatchObject({ fase: "listo", radicado: "FV-000123", registrado_en: creado.registrado_en });
    expect(f.crear).toBe(1);
    expect(f.subidas).toEqual(["firma"]);
  });

  it("a network failure at the create leaves no radicado, so a retry creates (idempotently) and goes on", async () => {
    const { f, deps } = servidor({ redCaida: true });
    const caido = await ejecutarEnvio(deps);
    expect(caido).toMatchObject({ fase: "error", etapa: "registro", sinConexion: true, radicado: undefined, mensaje: "No hay conexión con el servidor" });
    expect(f.subidas).toEqual([]);
    f.redCaida = false;
    const fin = await ejecutarEnvio(deps, progresoDe(caido));
    expect(fin).toMatchObject({ fase: "listo", radicado: "FV-000123" });
    expect(f.crear).toBe(2);
  });

  it("409 is reported as a conflict; other statuses are not", async () => {
    const { deps } = servidor();
    const conflicto = await ejecutarEnvio({ ...deps, crear: async () => Promise.reject(new ErrorEnvio("El identificador ya está en uso", { status: 409 })) });
    expect(conflicto).toMatchObject({ fase: "error", etapa: "registro", conflicto: true });
    const otro = await ejecutarEnvio({ ...deps, crear: async () => Promise.reject(new ErrorEnvio("Datos inválidos", { status: 422 })) });
    expect(otro).toMatchObject({ conflicto: false });
  });

  it("an unexpected exception becomes a plain error state, never a throw", async () => {
    const { deps } = servidor();
    const fin = await ejecutarEnvio({ ...deps, crear: async () => Promise.reject(new Error("boom")) });
    expect(fin).toMatchObject({ fase: "error", etapa: "registro", mensaje: "No se pudo crear el registro" });
  });

  it("when the server says something is missing, those files go back to pending and the retry uploads only them", async () => {
    const { f, deps } = servidor({ faltan: ["documento_frente"] });
    const incompleto = await ejecutarEnvio(deps);
    expect(incompleto).toMatchObject({ fase: "error", etapa: "archivos", fallidos: ["documento_frente"], radicado: "FV-000123" });
    expect((incompleto as Extract<EstadoEnvio, { fase: "error" }>).subidos).not.toContain("documento_frente");
    f.faltan = [];
    f.subidas.length = 0;
    expect((await ejecutarEnvio(deps, progresoDe(incompleto))).fase).toBe("listo");
    expect(f.subidas).toEqual(["documento_frente"]);
  });

  it("a failing completeness check is its own stage and keeps the radicado", async () => {
    const { deps } = servidor();
    const fin = await ejecutarEnvio({ ...deps, completar: async () => Promise.reject(new ErrorEnvio("Sin conexión", { sinConexion: true })) });
    expect(fin).toMatchObject({ fase: "error", etapa: "cierre", radicado: "FV-000123", sinConexion: true, fallidos: [] });
  });

  it("a manual verification only uploads the two photos", async () => {
    const { f, deps } = servidor();
    const fin = await ejecutarEnvio({ ...deps, archivos: ["documento_frente", "documento_reverso"] });
    expect(fin.fase).toBe("listo");
    expect(f.subidas).toEqual(["documento_frente", "documento_reverso"]);
  });

  it("ignores previously uploaded files that are no longer required", async () => {
    const { f, deps } = servidor();
    const fin = await ejecutarEnvio({ ...deps, archivos: ["documento_frente", "documento_reverso"] }, { radicado: "FV-000123", subidos: ["firma", "documento_frente"] });
    expect(fin.fase).toBe("listo");
    expect(f.subidas).toEqual(["documento_reverso"]);
  });

  it("two submits in a row (double click that slipped through) keep the same radicado", async () => {
    const { deps } = servidor();
    const [a, b] = await Promise.all([ejecutarEnvio(deps), ejecutarEnvio(deps)]);
    expect(a).toMatchObject({ radicado: "FV-000123" });
    expect(b).toMatchObject({ radicado: "FV-000123" });
  });

  it("never calls the optional state callback after finishing", async () => {
    const { deps } = servidor();
    const alCambiar = vi.fn();
    await ejecutarEnvio(deps, undefined, alCambiar);
    expect(alCambiar.mock.calls.every(([e]) => e.fase === "enviando")).toBe(true);
  });
});

describe("enmascararDocumento", () => {
  it("keeps only the last 4 characters of a normal number", () => {
    expect(enmascararDocumento("1234567890")).toBe("******7890");
    expect(enmascararDocumento("123456")).toBe("**3456");
  });
  it("short numbers keep just the last one; empty stays empty; letters are kept as typed", () => {
    expect(enmascararDocumento("12345")).toBe("****5");
    expect(enmascararDocumento("1")).toBe("1");
    expect(enmascararDocumento("  ")).toBe("");
    expect(enmascararDocumento("AB123456")).toBe("****3456");
  });
});
