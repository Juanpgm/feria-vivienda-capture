import { beforeEach, describe, expect, it, vi } from "vitest";

// Visibility rules (S7) of the list and detail pages: an inspector sees only their own visits; admins see all.
const listarVisitas = vi.fn(async (f: { uid?: string }) => (void f, []));
const obtenerVisita = vi.fn();
vi.mock("@/modules/mejoramiento/server/visitas.repo", async (orig) => ({
  ...(await orig<object>()),
  listarVisitas: (f: { uid?: string }) => listarVisitas(f),
  obtenerVisita: (id: string) => obtenerVisita(id),
}));
const firmarLectura = vi.fn(async (key: string) => `https://s3/${key}?firmada`);
vi.mock("@/shared/s3", () => ({ firmarLectura: (k: string) => firmarLectura(k) }));

import { detalleVisible, visitasVisibles } from "@/modules/mejoramiento/server/listado";

const sesion = (rol: string, uid = "ins1") => ({ uid, correo: `${uid}@cali.gov.co`, rol, aprobado: true }) as never;
const visita = (uid = "ins1") => ({
  codigo: "MV-000001",
  inspector: { uid, firma_key: `inspectores/${uid}/firma.png` },
  archivos: [{ ref: "p0", tipo: "foto", fila_id: "f1", key: "visitas-profesionales/MV-000001/registro-fotografico/MV-000001_290304_01.jpg" }],
  croquis: [{ key: "visitas-profesionales/MV-000001/croquis-visita/MV-000001_01.pdf" }],
});

describe("visitasVisibles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("an inspector lists only their own visits, whatever filter is asked", async () => {
    await visitasVisibles(sesion("inspector"));
    await visitasVisibles(sesion("inspector"), "otro");
    expect(listarVisitas.mock.calls).toEqual([[{ uid: "ins1" }], [{ uid: "ins1" }]]);
  });

  it("admin and superadmin list every visit, optionally filtered by inspector", async () => {
    await visitasVisibles(sesion("admin", "adm"));
    await visitasVisibles(sesion("superadmin", "sup"), "ins9");
    expect(listarVisitas.mock.calls).toEqual([[{ uid: undefined }], [{ uid: "ins9" }]]);
  });
});

describe("detalleVisible", () => {
  beforeEach(() => vi.clearAllMocks());

  it("another inspector's visit is not found (null) and nothing is signed", async () => {
    obtenerVisita.mockResolvedValue(visita("otro"));
    expect(await detalleVisible(sesion("inspector"), "v1")).toBeNull();
    obtenerVisita.mockResolvedValue(null);
    expect(await detalleVisible(sesion("admin", "adm"), "v1")).toBeNull();
    expect(firmarLectura).not.toHaveBeenCalled();
  });

  it("the owner and admins get presigned GETs for photos, inspector signature and croquis", async () => {
    obtenerVisita.mockResolvedValue(visita());
    const d = await detalleVisible(sesion("inspector"), "v1");
    expect(d?.visita.codigo).toBe("MV-000001");
    expect(Object.keys(d!.urls).sort()).toEqual([
      "inspectores/ins1/firma.png",
      "visitas-profesionales/MV-000001/croquis-visita/MV-000001_01.pdf",
      "visitas-profesionales/MV-000001/registro-fotografico/MV-000001_290304_01.jpg",
    ]);
    expect(d!.urls["inspectores/ins1/firma.png"]).toBe("https://s3/inspectores/ins1/firma.png?firmada");
    obtenerVisita.mockResolvedValue(visita("otro"));
    expect(await detalleVisible(sesion("superadmin", "sup"), "v1")).not.toBeNull();
  });
});
