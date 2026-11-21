import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory Firestore (documents + transactions, no contention). Never touches a real project.
/* eslint-disable @typescript-eslint/no-explicit-any */
const store = new Map<string, Record<string, any>>();
const snap = (path: string) => ({ exists: store.has(path), data: () => store.get(path) });
const docRef = (path: string): any => ({ path, get: async () => snap(path), update: async (d: any) => store.set(path, { ...store.get(path), ...d }) });
const colRef = (n: string) => ({ doc: (id: string) => docRef(`${n}/${id}`) });
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

import { crearVisita, VisitaError } from "./visitas.repo";

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
    expect(await crearVisita("v1", datos(), planear)).toEqual({ codigo: "MV-000001", archivos: [], registrada: true });
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
