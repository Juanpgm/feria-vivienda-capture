import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory Firestore double (get/set/add on documents). NOTHING here touches a real project.
/* eslint-disable @typescript-eslint/no-explicit-any */
const store = new Map<string, any>();
let auto = 0;
let fallaLog = false;
const snap = (path: string) => ({ exists: store.has(path), data: () => store.get(path) });
const docRef = (path: string): any => ({
  get: async () => snap(path),
  set: async (d: any) => void store.set(path, d),
  collection: (n: string) => colRef(`${path}/${n}`),
});
const colRef = (path: string): any => ({
  doc: (id: string) => docRef(`${path}/${id}`),
  add: async (d: any) => {
    if (fallaLog) throw new Error("log down");
    store.set(`${path}/auto${++auto}`, d);
  },
});

vi.mock("@/shared/firebase/admin", () => ({ adminDb: () => ({ collection: (n: string) => colRef(n) }) }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
const requireSesion = vi.fn();
vi.mock("@/modules/auth/server/sesion", async (orig) => ({ ...(await orig<object>()), requireSesion: (r: string) => requireSesion(r) }));

import { SesionError } from "@/modules/auth/server/sesion";
import { GET } from "@/app/api/registros/[id]/adjuntos/[tipo]/route";
import { POST } from "@/app/api/registros/[id]/adjuntos/route";
import { AdjuntoError, validarAdjunto } from "./adjuntos.repo";

const ID = "00000000-0000-4000-8000-000000000001";
const usuario = { uid: "u1", correo: "ana@cali.gov.co", rol: "usuario" };
const otro = { uid: "u2", correo: "otro@cali.gov.co", rol: "usuario" };
const admin = { uid: "a1", correo: "admin@cali.gov.co", rol: "admin" };

/** Smallest recognizable files (magic bytes + padding). */
const relleno = (cabecera: number[], total = 64) => Buffer.from([...cabecera, ...new Array(total - cabecera.length).fill(7)]);
const JPEG = relleno([0xff, 0xd8, 0xff, 0xe0]);
const PNG = relleno([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const b64 = (b: Buffer) => b.toString("base64");

const post = (cuerpo: unknown, id = ID) =>
  POST(new Request("http://x/api", { method: "POST", body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id }) });
const get = (tipo: string, id = ID) => GET(new Request("http://x/api", { headers: { "user-agent": "vitest" } }), { params: Promise.resolve({ id, tipo }) });

/** requireSesion mock honouring the minimum role like the real one. */
const sesionComo = (a: { uid: string; correo: string; rol: string }) =>
  requireSesion.mockImplementation(async (min: string) => {
    if (min === "admin" && a.rol === "usuario") throw new SesionError(403, "No tiene permisos");
    return a;
  });

beforeEach(() => {
  store.clear();
  fallaLog = false;
  requireSesion.mockReset();
  store.set(`registros/${ID}`, { registrado_por_uid: "u1" });
});

describe("validarAdjunto", () => {
  it("accepts jpeg/png by magic bytes, with or without data-URL prefix", () => {
    expect(validarAdjunto({ tipo: "documento_frente", imagen: b64(JPEG) }).mime).toBe("image/jpeg");
    expect(validarAdjunto({ tipo: "firma", imagen: `data:image/png;base64,${b64(PNG)}` }).mime).toBe("image/png");
  });

  it("rejects content that is not an image even when it claims to be one", () => {
    const texto = Buffer.from("<html>this is not an image at all</html>");
    expect(() => validarAdjunto({ tipo: "documento_frente", imagen: `data:image/jpeg;base64,${b64(texto)}` })).toThrow(AdjuntoError);
  });

  it("rejects invalid base64, unknown tipo and missing image", () => {
    expect(() => validarAdjunto({ tipo: "documento_frente", imagen: "###" })).toThrow(AdjuntoError);
    expect(() => validarAdjunto({ tipo: "otro", imagen: b64(JPEG) })).toThrow();
    expect(() => validarAdjunto({ tipo: "firma" })).toThrow();
  });

  it("enforces 900 KB for photos and 100 KB for the signature", () => {
    const grande = (kb: number) => b64(relleno([0xff, 0xd8, 0xff, 0xe0], kb * 1024));
    expect(validarAdjunto({ tipo: "documento_frente", imagen: grande(900) }).datos.length).toBe(900 * 1024);
    expect(() => validarAdjunto({ tipo: "documento_frente", imagen: grande(901) })).toThrow(/demasiado grande|tamaño máximo/);
    expect(validarAdjunto({ tipo: "firma", imagen: grande(100) }).datos.length).toBe(100 * 1024);
    expect(() => validarAdjunto({ tipo: "firma", imagen: grande(101) })).toThrow(/tamaño máximo/);
  });
});

describe("POST /api/registros/[id]/adjuntos", () => {
  it("stores bytes and metadata for the creator and does not return the image", async () => {
    sesionComo(usuario);
    const res = await post({ tipo: "documento_frente", imagen: b64(JPEG) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ tipo: "documento_frente", mime: "image/jpeg", bytes: JPEG.length, sin_cambios: false });
    expect(JSON.stringify(body)).not.toContain(b64(JPEG));
    expect(store.get(`registros/${ID}/adjuntos/documento_frente`)).toMatchObject({
      tipo: "documento_frente",
      mime: "image/jpeg",
      bytes: JPEG.length,
      sha256: body.sha256,
      subido_en: "TS",
      subido_por_uid: "u1",
      subido_por_correo: "ana@cali.gov.co",
    });
    expect(Buffer.compare(store.get(`registros/${ID}/adjuntos/documento_frente`).datos, JPEG)).toBe(0);
  });

  it("is idempotent: the same bytes change nothing; different bytes replace the attachment", async () => {
    sesionComo(usuario);
    await post({ tipo: "documento_frente", imagen: b64(JPEG) });
    store.get(`registros/${ID}/adjuntos/documento_frente`).subido_en = "PRIMERO";
    const repetido = await (await post({ tipo: "documento_frente", imagen: b64(JPEG) })).json();
    expect(repetido.sin_cambios).toBe(true);
    expect(store.get(`registros/${ID}/adjuntos/documento_frente`).subido_en).toBe("PRIMERO");

    const nuevo = await (await post({ tipo: "documento_frente", imagen: b64(PNG) })).json();
    expect(nuevo).toMatchObject({ sin_cambios: false, mime: "image/png" });
    expect(store.get(`registros/${ID}/adjuntos/documento_frente`).subido_en).toBe("TS");
    expect([...store.keys()].filter((k) => k.includes("/adjuntos/"))).toHaveLength(1);
  });

  it("404 when the registro belongs to someone else or does not exist (nothing written)", async () => {
    sesionComo(otro);
    expect((await post({ tipo: "documento_frente", imagen: b64(JPEG) })).status).toBe(404);
    sesionComo(usuario);
    expect((await post({ tipo: "documento_frente", imagen: b64(JPEG) }, "00000000-0000-4000-8000-0000000000ff")).status).toBe(404);
    expect((await post({ tipo: "documento_frente", imagen: b64(JPEG) }, "no-es-uuid")).status).toBe(404);
    expect([...store.keys()].filter((k) => k.includes("/adjuntos/"))).toHaveLength(0);
  });

  it("not even an admin can attach to a registro they did not create", async () => {
    sesionComo(admin);
    expect((await post({ tipo: "firma", imagen: b64(PNG) })).status).toBe(404);
  });

  it("422 for non-images and unknown tipo, 413 above the cap, 401 without session", async () => {
    sesionComo(usuario);
    expect((await post({ tipo: "documento_frente", imagen: b64(Buffer.from("hola mundo, no soy una imagen")) })).status).toBe(422);
    expect((await post({ tipo: "pasaporte", imagen: b64(JPEG) })).status).toBe(422);
    expect((await post({ tipo: "firma", imagen: b64(relleno([0xff, 0xd8, 0xff], 101 * 1024)) })).status).toBe(413);
    requireSesion.mockRejectedValue(new SesionError(401, "No autenticado"));
    expect((await post({ tipo: "firma", imagen: b64(PNG) })).status).toBe(401);
  });
});

describe("GET /api/registros/[id]/adjuntos/[tipo]", () => {
  beforeEach(async () => {
    sesionComo(usuario);
    await post({ tipo: "documento_frente", imagen: b64(JPEG) });
  });

  it("role usuario gets 403 and nothing is logged", async () => {
    sesionComo(usuario);
    expect((await get("documento_frente")).status).toBe(403);
    expect([...store.keys()].filter((k) => k.includes("accesos_adjuntos"))).toHaveLength(0);
  });

  it("admin gets the bytes with private no-store headers and an access-log entry", async () => {
    sesionComo(admin);
    const res = await get("documento_frente");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(Buffer.compare(Buffer.from(await res.arrayBuffer()), JPEG)).toBe(0);
    const logs = [...store.entries()].filter(([k]) => k.startsWith(`registros/${ID}/accesos_adjuntos/`)).map(([, v]) => v);
    expect(logs).toEqual([{ uid: "a1", correo: "admin@cali.gov.co", tipo: "documento_frente", accedido_en: "TS", user_agent: "vitest" }]);
  });

  it("each view adds one more log entry", async () => {
    sesionComo(admin);
    await get("documento_frente");
    await get("documento_frente");
    expect([...store.keys()].filter((k) => k.includes("accesos_adjuntos"))).toHaveLength(2);
  });

  it("404 for a missing attachment or bad tipo (no log); serves nothing when the log write fails", async () => {
    sesionComo(admin);
    expect((await get("documento_reverso")).status).toBe(404);
    expect((await get("../x")).status).toBe(404);
    expect([...store.keys()].filter((k) => k.includes("accesos_adjuntos"))).toHaveLength(0);
    fallaLog = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await get("documento_frente")).status).toBe(500);
  });
});
