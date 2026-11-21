import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSesion = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/modules/auth/server/sesion", async (orig) => ({ ...(await orig<object>()), requireSesion: (r: string) => requireSesion(r) }));
const reservarCroquis = vi.fn();
const guardarCroquis = vi.fn();
const obtenerVisita = vi.fn();
vi.mock("@/modules/mejoramiento/server/visitas.repo", async (orig) => ({
  ...(await orig<object>()),
  reservarCroquis: (...a: unknown[]) => reservarCroquis(...a),
  guardarCroquis: (...a: unknown[]) => guardarCroquis(...a),
  obtenerVisita: (id: string) => obtenerVisita(id),
}));
const firmarSubida = vi.fn(async (key: string) => ({ url: `https://s3/${key}`, headers: { "Content-Type": "x" } }));
const verificarObjeto = vi.fn();
const borrarObjeto = vi.fn();
vi.mock("@/shared/s3", () => ({ firmarSubida: (k: string) => firmarSubida(k), verificarObjeto: (k: string) => verificarObjeto(k), borrarObjeto: (k: string) => borrarObjeto(k) }));

import { SesionError } from "@/modules/auth/server/sesion";
import { VisitaError } from "@/modules/mejoramiento/server/visitas.repo";
import { POST as iniciar } from "./[id]/croquis/route";
import { POST as confirmar } from "./[id]/croquis/confirmar/route";

const ID = "v1";
const ctx = { params: Promise.resolve({ id: ID }) };
const post = (body: unknown) => iniciar(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), ctx);
const llamarConfirmar = () => confirmar(new Request("http://x", { method: "POST" }), ctx);
const como = (rol: string, uid = "ins1") => requireSesion.mockResolvedValue({ uid, correo: `${uid}@cali.gov.co`, rol, aprobado: true });
const archivos = [
  { ref: "a1", content_type: "image/jpeg", bytes: 1000, key: "inventada" },
  { ref: "a2", content_type: "application/pdf", bytes: 2000 },
];

describe("POST /api/visitas/[id]/croquis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    como("inspector");
    reservarCroquis.mockImplementation(async (_id: string, _alcance: unknown, planear: (c: string) => unknown[]) => ({ codigo: "MV-000007", croquis: planear("MV-000007") }));
  });

  it("assigns server keys croquis-visita/{codigo}_{nn}.{ext} and signs one PUT per file", async () => {
    const r = await post({ archivos });
    expect(r.status).toBe(200);
    const [id, alcance] = reservarCroquis.mock.calls[0];
    expect([id, alcance]).toEqual([ID, "ins1"]); // an inspector is scoped to their own visits
    expect(firmarSubida.mock.calls.map((c) => c[0])).toEqual([
      "visitas-profesionales/MV-000007/croquis-visita/MV-000007_01.jpg",
      "visitas-profesionales/MV-000007/croquis-visita/MV-000007_02.pdf",
    ]);
    const { subidas } = await r.json();
    expect(subidas.map((s: { ref: string }) => s.ref)).toEqual(["a1", "a2"]);
  });

  it("a restart after a partial upload deletes the stale first file and skips one that already matches", async () => {
    verificarObjeto.mockImplementation(async (k: string) =>
      k.endsWith("_01.jpg") ? { bytes: 1, content_type: "image/jpeg" } : k.endsWith("_02.pdf") ? { bytes: archivos[1].bytes, content_type: "application/pdf" } : null,
    );
    const { subidas } = await (await post({ archivos })).json();
    expect(borrarObjeto).toHaveBeenCalledWith("visitas-profesionales/MV-000007/croquis-visita/MV-000007_01.jpg");
    expect(subidas.map((s: { ref: string }) => s.ref)).toEqual(["a1"]);
  });

  it("an admin or superadmin acts on any visit (no owner scope)", async () => {
    como("admin", "adm");
    expect((await post({ archivos })).status).toBe(200);
    como("superadmin", "sup");
    expect((await post({ archivos })).status).toBe(200);
    expect(reservarCroquis.mock.calls.map((c) => c[1])).toEqual([null, null]);
  });

  it("a usuario is refused; the repo answers 404/409 for foreign, unregistered or already loaded visits", async () => {
    requireSesion.mockRejectedValue(new SesionError(403, "No tiene permisos"));
    expect((await post({ archivos })).status).toBe(403);
    como("inspector");
    reservarCroquis.mockRejectedValueOnce(new VisitaError(404, "Visita no encontrada"));
    expect((await post({ archivos })).status).toBe(404);
    reservarCroquis.mockRejectedValueOnce(new VisitaError(409, "La visita ya tiene croquis"));
    expect((await post({ archivos })).status).toBe(409);
  });

  it("422 for zero or more than 4 files, a type outside the allowlist, an oversized file or repeated refs", async () => {
    const f = (i: number) => ({ ref: `a${i}`, content_type: "image/png", bytes: 10 });
    expect((await post({ archivos: [] })).status).toBe(422);
    expect((await post({ archivos: [1, 2, 3, 4, 5].map(f) })).status).toBe(422);
    expect((await post({ archivos: [{ ref: "a", content_type: "image/gif", bytes: 10 }] })).status).toBe(422);
    expect((await post({ archivos: [{ ref: "a", content_type: "image/png", bytes: 9 * 1024 * 1024 }] })).status).toBe(422);
    expect((await post({ archivos: [f(1), f(1)] })).status).toBe(422);
    expect(reservarCroquis).not.toHaveBeenCalled();
    expect((await post({ archivos: [1, 2, 3, 4].map(f) })).status).toBe(200);
  });
});

describe("POST /api/visitas/[id]/croquis/confirmar", () => {
  const pendiente = [
    { ref: "a1", key: "k1", content_type: "image/jpeg", bytes: 1000 },
    { ref: "a2", key: "k2", content_type: "application/pdf", bytes: 2000 },
  ];
  const visita = (extra: Record<string, unknown> = {}) => ({ codigo: "MV-000007", estado: "registrada", tiene_croquis: false, inspector: { uid: "ins1" }, croquis_pendiente: pendiente, ...extra });
  beforeEach(() => {
    vi.clearAllMocks();
    como("inspector");
    obtenerVisita.mockResolvedValue(visita());
  });

  it("409 with faltantes when an object is missing or differs; nothing is saved", async () => {
    verificarObjeto.mockResolvedValueOnce(null).mockResolvedValueOnce({ bytes: 2000, content_type: "application/pdf" });
    const r = await llamarConfirmar();
    expect(r.status).toBe(409);
    expect((await r.json()).faltantes).toEqual(["a1"]);
    expect(guardarCroquis).not.toHaveBeenCalled();
  });

  it("saves the verified croquis (tiene_croquis true) with who loaded it", async () => {
    verificarObjeto.mockResolvedValueOnce({ bytes: 1000, content_type: "image/jpeg" }).mockResolvedValueOnce({ bytes: 2000, content_type: "application/pdf" });
    const r = await llamarConfirmar();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, tiene_croquis: true });
    expect(guardarCroquis).toHaveBeenCalledWith(ID, pendiente, "ins1");
  });

  it("another inspector's visit is not found; an admin may confirm it", async () => {
    obtenerVisita.mockResolvedValue(visita({ inspector: { uid: "otro" } }));
    expect((await llamarConfirmar()).status).toBe(404);
    como("admin", "adm");
    verificarObjeto.mockResolvedValue({ bytes: 1000, content_type: "image/jpeg" });
    obtenerVisita.mockResolvedValue(visita({ inspector: { uid: "otro" }, croquis_pendiente: [pendiente[0]] }));
    expect((await llamarConfirmar()).status).toBe(200);
    expect(guardarCroquis).toHaveBeenCalledWith(ID, [pendiente[0]], "adm");
  });

  it("is idempotent once loaded and 409 when nothing is pending", async () => {
    obtenerVisita.mockResolvedValue(visita({ tiene_croquis: true, croquis_pendiente: undefined }));
    expect((await llamarConfirmar()).status).toBe(200);
    obtenerVisita.mockResolvedValue(visita({ croquis_pendiente: undefined }));
    expect((await llamarConfirmar()).status).toBe(409);
    expect(guardarCroquis).not.toHaveBeenCalled();
  });
});
