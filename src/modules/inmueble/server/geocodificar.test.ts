import { describe, expect, it } from "vitest";
import { geocodificar, interpretar } from "./geocodificar";

// Shapes captured from https://geocodificador.ia.cali.gov.co/api/individual/geocodificar on 2026-11-18.
const UBICADA = {
  direccionEstandarizada: { direccion: "CL 5 # 38 - 20" },
  barrio: { codigo: "1908", nombre: "Santa Isabel" },
  estrato: "4",
  comuna: "19",
  latitud: 3.427997918574184,
  longitud: -76.54539517234421,
  estado: "C - Normalizado y georreferenciado aproximado",
};
const NO_UBICADA = { direccionEstandarizada: { direccion: "AV 5 NORTE # 5N - 02" }, barrio: null, estrato: null, latitud: null, longitud: null, estado: "D - Normalizado y no georreferenciado" };

describe("geocodificador de la Alcaldía de Cali", () => {
  it("maps a located address to our barrio, comuna, estrato and coordinates", () => {
    expect(interpretar(UBICADA)).toEqual({
      direccion_catastral: "CL 5 # 38 - 20", id_barrio_vereda: "1908", nombre_barrio_vereda: "Santa Isabel", codigo_division: "19",
      estrato: 4, latitud: 3.427998, longitud: -76.545395,
    });
  });
  it("falls back to the barrio's estrato moda when the service has none", () => {
    expect(interpretar({ ...UBICADA, barrio: { codigo: "0206" }, estrato: null })?.estrato).toBe(5);
  });
  it("keeps only the cadastral address when the address could not be located", () => {
    expect(interpretar(NO_UBICADA)).toMatchObject({ direccion_catastral: "AV 5 NORTE # 5N - 02", id_barrio_vereda: null, latitud: null });
  });
  it("posts the address and degrades to null when the service fails", async () => {
    let cuerpo = "";
    const ok = (async (_u: string, init?: RequestInit) => {
      cuerpo = String(init?.body);
      return new Response(JSON.stringify(UBICADA));
    }) as unknown as typeof fetch;
    expect((await geocodificar("Calle 5 #  38-20", ok))?.id_barrio_vereda).toBe("1908");
    expect(JSON.parse(cuerpo)).toEqual({ direccion: "Calle 5 # 38-20" });
    const caido = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    expect(await geocodificar("Carrera 1 # 2-3 otra", caido)).toBeNull();
    const roto = (async () => { throw new Error("red"); }) as unknown as typeof fetch;
    expect(await geocodificar("Carrera 1 # 2-4 otra", roto)).toBeNull();
  });
});
