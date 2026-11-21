import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSesion = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/modules/auth/server/sesion", async (orig) => ({ ...(await orig<object>()), requireSesion: (r: string) => requireSesion(r) }));
const obtenerUsuario = vi.fn();
vi.mock("@/modules/auth/server/usuarios.repo", () => ({ obtenerUsuario: (u: string) => obtenerUsuario(u) }));
vi.mock("@/modules/mejoramiento/server/apus.repo", () => ({
  apusPorItem: async () => new Map([["290304", { item: "290304", descripcion: "ESTUCO Y PINTURA", und: "M2", costo_unitario: 21000, capitulo: "29", capitulo_nombre: "PINTURA" }]]),
}));
const crearVisita = vi.fn();
const obtenerVisita = vi.fn();
const marcarRegistrada = vi.fn();
vi.mock("@/modules/mejoramiento/server/visitas.repo", async (orig) => ({
  ...(await orig<object>()),
  crearVisita: (...a: unknown[]) => crearVisita(...a),
  obtenerVisita: (id: string) => obtenerVisita(id),
  marcarRegistrada: (id: string) => marcarRegistrada(id),
}));
const firmarSubida = vi.fn(async (key: string) => ({ url: `https://s3/${key}`, headers: { "Content-Type": "x" } }));
const verificarObjeto = vi.fn();
const borrarObjeto = vi.fn();
vi.mock("@/shared/s3", () => ({ firmarSubida: (k: string) => firmarSubida(k), verificarObjeto: (k: string) => verificarObjeto(k), borrarObjeto: (k: string) => borrarObjeto(k) }));

import { SesionError } from "@/modules/auth/server/sesion";
import { POST as confirmar } from "./[id]/confirmar/route";
import { POST as enviar } from "./route";

const ID = "0b6f1c2e-5d8a-4c1e-9f00-aaaaaaaaaaaa";
const fotos = Array.from({ length: 6 }, (_, i) => ({ ref: `p${i}`, tipo: "foto", fila_id: "f1", content_type: "image/jpeg", bytes: 1000, key: "inventada/por/el/cliente" }));
const cuerpo = (extra: Record<string, unknown> = {}) => ({
  visita: {
    id: ID,
    atiende: { relacion: "propietario", nombre: "Ana María Pérez", documento: "1144555" },
    propietario: { nombre: "Ana María Pérez", tipo_documento: "cc", documento: "1144555", telefono: "3001234567", direccion: "Cra 5 # 10-20", anios_habitando: 12, personas: 4 },
    diagnostico: { aplica: "si", aplica_para: ["acabado_muros"], alcance: "tipo" },
    capitulos: [{ id: "c1", nombre: "Estuco y pintura", filas: [{ id: "f1", item: "290304", cantidad_expr: "(1,87+3,4)*2,7" }] }],
    observaciones: "Se explican los alcances",
  },
  ubicacion: { lat: 3.45163, lon: -76.53237, precision_m: 8 },
  archivos: [...fotos, { ref: "firma", tipo: "firma_ciudadano", content_type: "image/png", bytes: 400 }],
  ...extra,
});
const post = (body: unknown) => enviar(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
const inspector = () => requireSesion.mockResolvedValue({ uid: "ins1", correo: "ins@cali.gov.co", rol: "inspector", aprobado: true });

describe("POST /api/visitas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inspector();
    obtenerUsuario.mockResolvedValue({ nombre: "Ana Inspectora", cargo: "Arquitecta", firma_key: "inspectores/ins1/firma.png" });
    crearVisita.mockImplementation(async (_id: string, _d: unknown, planear: (c: string) => unknown[]) => ({ codigo: "MV-000001", archivos: planear("MV-000001"), registrada: false }));
  });

  it("prices rows on the server, locates comuna/barrio and signs one PUT per server-chosen key", async () => {
    const res = await post(cuerpo());
    expect(res.status).toBe(200);
    const [, datos] = crearVisita.mock.calls[0] as [string, Record<string, any>]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(datos.capitulos[0].filas[0]).toMatchObject({ descripcion: "ESTUCO Y PINTURA", costo_unitario: 21000, cantidad: 14.229, costo_directo: 298809 });
    expect(datos.costo_directo_total).toBe(298809);
    expect(datos.ubicacion).toMatchObject({ comuna_corregimiento: { codigo: "03" }, barrio_vereda: { id: "0311", nombre: "San Pedro" } });
    expect(datos.inspector).toMatchObject({ uid: "ins1", firma_key: "inspectores/ins1/firma.png" });
    const { subidas, codigo } = await res.json();
    expect(codigo).toBe("MV-000001");
    expect(subidas).toHaveLength(7);
    const keys = firmarSubida.mock.calls.map((c) => c[0]);
    expect(keys).not.toContain("inventada/por/el/cliente");
    expect(keys[0]).toBe("visitas-profesionales/MV-000001/registro-fotografico/MV-000001_290304_01.jpg");
    expect(keys[6]).toBe("visitas-profesionales/MV-000001/firma-ciudadano/MV-000001_1144555_01.png");
  });

  it("a retry signs only the files that are not yet in S3", async () => {
    crearVisita.mockImplementation(async (_id: string, _d: unknown, planear: (c: string) => unknown[]) => ({ codigo: "MV-000001", archivos: planear("MV-000001"), registrada: false, reintento: true }));
    verificarObjeto.mockImplementation(async (k: string) => (k.endsWith("_01.jpg") ? { bytes: 1000, content_type: "image/jpeg" } : null));
    const { subidas } = await (await post(cuerpo())).json();
    expect(subidas.map((s: { ref: string }) => s.ref)).toEqual(["p1", "p2", "p3", "p4", "p5", "firma"]);
  });

  it("a corrected retry replaces a stale object left by the failed attempt (create-only PUTs cannot overwrite)", async () => {
    crearVisita.mockImplementation(async (_id: string, _d: unknown, planear: (c: string) => unknown[]) => ({ codigo: "MV-000001", archivos: planear("MV-000001"), registrada: false, reintento: true }));
    verificarObjeto.mockImplementation(async (k: string) => (k.endsWith("_01.jpg") ? { bytes: 777, content_type: "image/jpeg" } : null));
    const { subidas } = await (await post(cuerpo())).json();
    expect(borrarObjeto).toHaveBeenCalledWith("visitas-profesionales/MV-000001/registro-fotografico/MV-000001_290304_01.jpg");
    expect(subidas.map((s: { ref: string }) => s.ref)).toContain("p0");
  });

  it("only the inspector role submits; an inspector without a registered signature is stopped", async () => {
    requireSesion.mockResolvedValue({ uid: "a", correo: "a@x", rol: "admin", aprobado: true });
    expect((await post(cuerpo())).status).toBe(403);
    requireSesion.mockRejectedValue(new SesionError(403, "No tiene permisos"));
    expect((await post(cuerpo())).status).toBe(403);
    inspector();
    obtenerUsuario.mockResolvedValue({ nombre: "Ana", firma_key: null });
    const r = await post(cuerpo());
    expect(r.status).toBe(409);
    expect((await r.json()).requiere_firma).toBe(true);
    expect(crearVisita).not.toHaveBeenCalled();
  });

  it("422 for fewer than 6 photos, a missing signature or an ITEM outside APUS", async () => {
    expect((await post(cuerpo({ archivos: fotos.slice(0, 5) }))).status).toBe(422);
    const sinApu = cuerpo();
    (sinApu.visita.capitulos[0].filas[0] as { item: string }).item = "999999";
    const r = await post(sinApu);
    expect(r.status).toBe(422);
    expect((await r.json()).error).toContain("999999");
    expect(crearVisita).not.toHaveBeenCalled();
  });

  it("422 for an invalid body (bad coordinate)", async () => {
    expect((await post(cuerpo({ ubicacion: { lat: 200, lon: 0, precision_m: null } }))).status).toBe(422);
  });
});

describe("POST /api/visitas/[id]/confirmar", () => {
  const llamar = () => confirmar(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: ID }) });
  const archivos = [
    { ref: "p0", key: "k0", bytes: 1000, content_type: "image/jpeg" },
    { ref: "firma", key: "k1", bytes: 400, content_type: "image/png" },
  ];
  beforeEach(() => {
    vi.clearAllMocks();
    inspector();
    obtenerVisita.mockResolvedValue({ codigo: "MV-000001", estado: "archivos_pendientes", inspector: { uid: "ins1" }, archivos });
  });

  it("registers when every object is in S3 with the declared size and type", async () => {
    verificarObjeto.mockResolvedValueOnce({ bytes: 1000, content_type: "image/jpeg" }).mockResolvedValueOnce({ bytes: 400, content_type: "image/png" });
    expect((await llamar()).status).toBe(200);
    expect(marcarRegistrada).toHaveBeenCalledWith(ID);
  });

  it("409 with the missing refs when a file is absent or differs", async () => {
    verificarObjeto.mockResolvedValueOnce(null).mockResolvedValueOnce({ bytes: 999, content_type: "image/png" });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect((await r.json()).faltantes).toEqual(["p0", "firma"]);
    expect(marcarRegistrada).not.toHaveBeenCalled();
  });

  it("another inspector's visit is not found", async () => {
    obtenerVisita.mockResolvedValue({ codigo: "MV-000001", estado: "archivos_pendientes", inspector: { uid: "otro" }, archivos });
    expect((await llamar()).status).toBe(404);
  });
});
