import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory Firestore (documents + transactions, no contention). Never touches a real project.
/* eslint-disable @typescript-eslint/no-explicit-any */
const store = new Map<string, Record<string, any>>();
const snap = (path: string) => ({ exists: store.has(path), data: () => store.get(path) });
const docRef = (path: string): any => ({ path, get: async () => snap(path), update: async (d: any) => store.set(path, { ...store.get(path), ...d }) });
// Query support for listarVisitas: one equality filter, one orderBy desc, limit.
const consulta = (n: string, filtro?: [string, unknown], orden?: string, tope = Infinity): any => ({
  where: (campo: string, _op: string, valor: unknown) => consulta(n, [campo, valor], orden, tope),
  orderBy: (campo: string) => consulta(n, filtro, campo, tope),
  limit: (l: number) => consulta(n, filtro, orden, l),
  get: async () => {
    const leer = (d: any, ruta: string) => ruta.split(".").reduce((o, k) => o?.[k], d);
    let docs = [...store.entries()].filter(([k]) => k.startsWith(`${n}/`)).map(([, d]) => d);
    if (filtro) docs = docs.filter((d) => leer(d, filtro[0]) === filtro[1]);
    if (orden) docs.sort((a, b) => String(leer(b, orden)).localeCompare(String(leer(a, orden))));
    return { docs: docs.slice(0, tope).map((d) => ({ id: d.id, data: () => d })) };
  },
});
const colRef = (n: string) => ({ doc: (id: string) => docRef(`${n}/${id}`), ...consulta(n) });
const runTransaction = async (fn: (tx: any) => Promise<unknown>) => {
  const pendientes: (() => void)[] = [];
  const tx = {
    get: async (r: any) => snap(r.path),
    set: (r: any, d: any) => pendientes.push(() => store.set(r.path, d)),
    create: (r: any, d: any) => pendientes.push(() => store.set(r.path, d)),
    update: (r: any, d: any) => pendientes.push(() => store.set(r.path, { ...store.get(r.path), ...d })),
  };
  const out = await fn(tx);
  pendientes.forEach((p) => p());
  return out;
};
vi.mock("@/shared/firebase/admin", () => ({ adminDb: () => ({ collection: colRef, runTransaction }) }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import { crearVisita, guardarCroquis, listarVisitas, reservarCroquis, VisitaError } from "./visitas.repo";

const inspector = (uid = "ins1") => ({ uid, nombre: "Ana Inspectora", correo: "a@cali.gov.co", cargo: "Arquitecta", firma_key: `inspectores/${uid}/firma.png` });
const datos = (uid = "ins1") => ({ inspector: inspector(uid), observaciones: "x" }) as any;
const planear = (codigo: string) => [{ ref: "firma", tipo: "firma_ciudadano", content_type: "image/png", bytes: 5, key: `visitas-profesionales/${codigo}/firma-ciudadano/${codigo}_1_01.png` }] as any;

describe("crearVisita", () => {
  beforeEach(() => store.clear());

  it("takes consecutive MV codes and starts as archivos_pendientes without croquis", async () => {
    const a = await crearVisita("v1", datos(), planear);
    const b = await crearVisita("v2", datos(), planear);
    expect([a.codigo, b.codigo]).toEqual(["MV-000001", "MV-000002"]);
    expect(store.get("visitas_mejoramiento/v1")).toMatchObject({ codigo: "MV-000001", estado: "archivos_pendientes", tiene_croquis: false, prueba: false });
    expect(store.get("visitas_mejoramiento/v1")?.archivos[0].key).toContain("visitas-profesionales/MV-000001/");
  });

  it("a retry of the same id keeps its code; a registered one returns no uploads", async () => {
    await crearVisita("v1", datos(), planear);
    expect((await crearVisita("v1", datos(), planear)).codigo).toBe("MV-000001");
    expect(store.get("contadores/visitas_mejoramiento")?.ultimo).toBe(1);
    store.set("visitas_mejoramiento/v1", { ...store.get("visitas_mejoramiento/v1"), estado: "registrada" });
    expect(await crearVisita("v1", datos(), planear)).toEqual({ codigo: "MV-000001", archivos: [], registrada: true, reintento: true });
  });

  it("another inspector cannot reuse an id", async () => {
    await crearVisita("v1", datos(), planear);
    await expect(crearVisita("v1", datos("otro"), planear)).rejects.toBeInstanceOf(VisitaError);
  });

  it("test accounts number from MV-020001", async () => {
    store.set("usuarios/ins1", { prueba: true });
    expect((await crearVisita("v1", datos(), planear)).codigo).toBe("MV-020001");
    expect(store.get("visitas_mejoramiento/v1")?.prueba).toBe(true);
  });
});

const guardada = (id: string, uid: string, fecha: string, extra: Record<string, any> = {}) =>
  store.set(`visitas_mejoramiento/${id}`, {
    id,
    codigo: `MV-${id}`,
    fecha_visita: fecha,
    estado: "registrada",
    tiene_croquis: false,
    croquis: [],
    propietario: { nombre: "ANA PEREZ", documento: "1144555", direccion: "CR 5 10 20" },
    ubicacion: { comuna_corregimiento: { nombre: "Comuna 3" }, barrio_vereda: { nombre: "San Pedro" } },
    costo_directo_total: 100,
    inspector: inspector(uid),
    prueba: false,
    archivos: [{ key: "secreta" }],
    ...extra,
  });

describe("listarVisitas", () => {
  beforeEach(() => {
    store.clear();
    guardada("1", "ins1", "2026-11-18T09:00:00.000-05:00");
    guardada("2", "otro", "2026-11-19T09:00:00.000-05:00");
    guardada("3", "ins1", "2026-11-20T09:00:00.000-05:00", { ubicacion: { comuna_corregimiento: null, barrio_vereda: null } });
  });

  it("by inspector: only their visits, newest first, as compact rows without file keys", async () => {
    const filas = await listarVisitas({ uid: "ins1" });
    expect(filas.map((f) => f.id)).toEqual(["3", "1"]);
    expect(filas[1]).toEqual({
      id: "1",
      codigo: "MV-1",
      fecha_visita: "2026-11-18T09:00:00.000-05:00",
      estado: "registrada",
      tiene_croquis: false,
      propietario: { nombre: "ANA PEREZ", documento: "1144555" },
      direccion: "CR 5 10 20",
      comuna: "Comuna 3",
      barrio: "San Pedro",
      costo_directo_total: 100,
      inspector: { uid: "ins1", nombre: "Ana Inspectora" },
      prueba: false,
    });
    expect(filas[0]).toMatchObject({ comuna: null, barrio: null });
  });

  it("without uid: every visit, newest first", async () => {
    expect((await listarVisitas()).map((f) => f.id)).toEqual(["3", "2", "1"]);
  });
});

describe("croquis", () => {
  const plan = (codigo: string) => [{ ref: "a1", content_type: "image/jpeg", bytes: 10, key: `visitas-profesionales/${codigo}/croquis-visita/${codigo}_01.jpg` }];
  beforeEach(() => {
    store.clear();
    guardada("1", "ins1", "2026-11-18T09:00:00.000-05:00");
  });

  it("reserves keys for the owner or an admin (null scope); 404 for another inspector", async () => {
    await expect(reservarCroquis("1", "otro", plan)).rejects.toMatchObject({ status: 404 });
    await expect(reservarCroquis("nada", null, plan)).rejects.toMatchObject({ status: 404 });
    expect((await reservarCroquis("1", "ins1", plan)).croquis[0].key).toContain("MV-1_01.jpg");
    expect((await reservarCroquis("1", null, plan)).codigo).toBe("MV-1");
    expect(store.get("visitas_mejoramiento/1")?.croquis_pendiente).toEqual(plan("MV-1"));
  });

  it("409 while files are pending or once croquis is loaded", async () => {
    guardada("2", "ins1", "x", { estado: "archivos_pendientes" });
    await expect(reservarCroquis("2", "ins1", plan)).rejects.toMatchObject({ status: 409 });
    guardada("3", "ins1", "x", { tiene_croquis: true });
    await expect(reservarCroquis("3", "ins1", plan)).rejects.toMatchObject({ status: 409 });
  });

  it("guardarCroquis sets croquis, tiene_croquis, who and when; refuses if the pending set changed", async () => {
    await reservarCroquis("1", "ins1", plan);
    await expect(guardarCroquis("1", [{ ...plan("MV-1")[0], bytes: 11 }], "ins1")).rejects.toMatchObject({ status: 409 });
    await guardarCroquis("1", plan("MV-1"), "ins1");
    expect(store.get("visitas_mejoramiento/1")).toMatchObject({
      tiene_croquis: true,
      croquis: [{ key: "visitas-profesionales/MV-1/croquis-visita/MV-1_01.jpg", content_type: "image/jpeg", bytes: 10 }],
      croquis_por_uid: "ins1",
      croquis_cargado_en: "TS",
      croquis_pendiente: [],
    });
  });
});
