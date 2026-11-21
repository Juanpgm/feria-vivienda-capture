import { describe, expect, it } from "vitest";
import { filasInforme, resumenInforme } from "./informe";

const fila = (extra: Record<string, unknown> = {}) =>
  ({
    id: "v1",
    codigo: "MV-000001",
    fecha_visita: "2026-11-20T10:05:00.000-05:00",
    estado: "registrada",
    tiene_croquis: false,
    propietario: { nombre: "ANA MARIA PEREZ", documento: "1144555" },
    direccion: "CR 5 10 20",
    comuna: "Comuna 3",
    barrio: "San Pedro",
    costo_directo_total: 298809,
    inspector: { uid: "ins1", nombre: "Ana Inspectora" },
    prueba: false,
    ...extra,
  }) as never;

describe("informe de visitas", () => {
  it("one row per visit with code, Bogota date/time, owner + document, address, comuna/barrio, state, croquis and direct cost", () => {
    const [r] = filasInforme([fila()]);
    expect(r[0]).toBe("MV-000001");
    expect(r[1]).toMatch(/^20\/11\/2026, 10:05/);
    expect(r.slice(2)).toEqual(["ANA MARIA PEREZ\n1144555", "CR 5 10 20", "Comuna 3 / San Pedro", "Registrada", "Sin croquis", expect.stringContaining("298.809")]);
  });

  it("pending files, loaded croquis and unknown location read plainly", () => {
    const [r] = filasInforme([fila({ estado: "archivos_pendientes", tiene_croquis: true, comuna: null, barrio: null })]);
    expect(r.slice(4, 7)).toEqual(["Sin ubicar", "Archivos pendientes", "Croquis cargado"]);
  });

  it("totals: number of visits and sum of direct cost", () => {
    expect(resumenInforme([fila(), fila({ costo_directo_total: 1191 })])).toEqual({ cantidad: 2, total: 300000 });
    expect(resumenInforme([])).toEqual({ cantidad: 0, total: 0 });
  });
});
