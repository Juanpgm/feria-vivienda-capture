import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory Firestore double with optimistic transactions (reads are versioned; a conflicting commit re-runs the
// callback, like the real SDK). NOTHING here touches a real project.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Datos = Record<string, any>;
const store = new Map<string, Datos>();
const versiones = new Map<string, number>();
let auto = 0;
let antesDeConfirmar: (() => void) | null = null;
const llamadas: any[][] = [];

const dato = (data: Datos, campo: string) => campo.split(".").reduce<any>((o, k) => o?.[k], data);
const snap = (path: string) => ({ id: path.split("/").pop()!, exists: store.has(path), data: () => store.get(path) });
const escribir = (path: string, d: Datos) => (store.set(path, d), versiones.set(path, (versiones.get(path) ?? 0) + 1));
const hijos = (path: string) => [...store.keys()].filter((k) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/"));

const consulta = (path: string, igualdad: [string, unknown][] = [], limite = Infinity): any => ({
  where: (c: string, op: string, v: unknown) => (llamadas.push(["where", c, op, v]), consulta(path, op === "==" ? [...igualdad, [c, v]] : igualdad, limite)),
  orderBy: (...a: unknown[]) => (llamadas.push(["orderBy", ...a]), consulta(path, igualdad, limite)),
  startAfter: (...a: unknown[]) => (llamadas.push(["startAfter", ...a]), consulta(path, igualdad, limite)),
  select: () => consulta(path, igualdad, limite),
  limit: (n: number) => (llamadas.push(["limit", n]), consulta(path, igualdad, n)),
  get: async () => ({
    docs: hijos(path)
      .filter((k) => igualdad.every(([c, v]) => dato(store.get(k)!, c) === v))
      .slice(0, limite)
      .map(snap),
  }),
});
const docRef = (path: string): any => ({
  id: path.split("/").pop(),
  path,
  get: async () => snap(path),
  collection: (n: string) => colRef(`${path}/${n}`),
});
const colRef = (path: string): any => ({ ...consulta(path), doc: (id = `auto${++auto}`) => docRef(`${path}/${id}`) });

const runTransaction = async (fn: (tx: any) => Promise<unknown>) => {
  for (;;) {
    const leidos = new Map<string, number>();
    const pendientes: (() => void)[] = [];
    const tx = {
      get: async (r: any) => (leidos.set(r.path, versiones.get(r.path) ?? 0), snap(r.path)),
      set: (r: any, d: Datos) => pendientes.push(() => escribir(r.path, d)),
      create: (r: any, d: Datos) =>
        pendientes.push(() => {
          if (store.has(r.path)) throw Object.assign(new Error("exists"), { code: 6 });
          escribir(r.path, d);
        }),
    };
    const out = await fn(tx);
    antesDeConfirmar?.();
    antesDeConfirmar = null;
    if ([...leidos].some(([p, v]) => (versiones.get(p) ?? 0) !== v)) continue; // contention: re-run
    pendientes.forEach((p) => p());
    return out;
  }
};

vi.mock("@/shared/firebase/admin", () => ({
  adminDb: () => ({ collection: (n: string) => colRef(n), runTransaction }),
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "TS" },
  FieldPath: { documentId: () => "__name__" },
  Timestamp: class {
    constructor(
      public seconds: number,
      public nanoseconds: number,
    ) {}
    static fromMillis = (ms: number) => ({ ms });
    toDate = () => new Date(this.seconds * 1000);
  },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
const requireSesion = vi.fn();
vi.mock("@/modules/auth/server/sesion", async (orig) => ({ ...(await orig<object>()), requireSesion: (r: string) => requireSesion(r) }));

import { registroSchema } from "../domain/schema";
import { valido } from "../domain/fixture";
import { buscarDuplicados, crearRegistro, listarRegistros, obtenerRegistro, RegistroConflictoError } from "./registro.repo";
import { GET as GETDuplicado } from "@/app/api/registros/duplicado/route";
import { GET as GETLista, POST } from "@/app/api/registros/route";
import { GET as GETDetalle } from "@/app/api/registros/[id]/route";

const datos = (id = valido().id, doc = "1.234.567-8") => {
  const v = valido();
  return registroSchema.parse({ ...v, id, solicitante: { ...v.solicitante, numero_documento: doc } });
};
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = { uid: "u1", rol: "usuario" as const, correo: "ana.func@cali.gov.co" };
const admin = { uid: "a1", rol: "admin" as const, correo: "admin@cali.gov.co" };
const contador = () => store.get("contadores/radicado")?.ultimo;

beforeEach(() => {
  store.clear();
  versiones.clear();
  llamadas.length = 0;
  antesDeConfirmar = null;
  delete process.env.RADICADO_PREFIJO;
  store.set("usuarios/u1", { nombre: "Ana Funcionaria", correo: actor.correo });
});

describe("crearRegistro", () => {
  it("creates once with audit fields, creator, radicado, review status and a historial entry", async () => {
    const r = await crearRegistro(datos(), actor);
    expect(r).toMatchObject({ id: valido().id, radicado: "FV-000001", creado: true, advertencias: [] });
    const doc = store.get(`registros/${valido().id}`)!;
    expect(doc).toMatchObject({
      id: valido().id,
      radicado: "FV-000001",
      radicado_numero: 1,
      estado: "registrado",
      estado_revision: "pendiente_revision",
      estado_revision_por_uid: "u1",
      fuente: "app",
      version_esquema: 2,
      registrado_por_uid: "u1",
      registrado_por_nombre: "Ana Funcionaria",
      registrado_por_correo: actor.correo,
      registrado_en: "TS",
      creado_en: "TS",
      actualizado_en: "TS",
      documento_clave: "12345678",
      documento_digitos: "12345678",
      nombre_busqueda: "ana maria perez",
    });
    expect(doc.solicitante.edad).toBeGreaterThanOrEqual(35);
    expect(doc).not.toHaveProperty("id_usuario_registro");
    const historial = [...store].filter(([k]) => k.startsWith(`registros/${valido().id}/historial/`));
    expect(historial).toHaveLength(1);
    expect(historial[0][1]).toMatchObject({ tipo: "creacion", estado_revision: "pendiente_revision", por_uid: "u1", por_correo: actor.correo });
    expect(contador()).toBe(1);
  });

  it("never stores undefined values (the Admin SDK rejects them)", async () => {
    await crearRegistro(datos(), actor);
    const rutas: string[] = [];
    const recorrer = (v: unknown, ruta: string) => {
      if (v === undefined) rutas.push(ruta);
      else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => recorrer(x, `${ruta}.${k}`));
    };
    recorrer(store.get(`registros/${valido().id}`), "registro");
    expect(rutas).toEqual([]);
  });

  it("falls back to the email local part when the profile has no name", async () => {
    store.delete("usuarios/u1");
    await crearRegistro(datos(), actor);
    expect(store.get(`registros/${valido().id}`)!.registrado_por_nombre).toBe("ana.func");
  });

  it("the prefix comes from RADICADO_PREFIJO (sanitized, default FV)", async () => {
    process.env.RADICADO_PREFIJO = "ab";
    expect((await crearRegistro(datos(uuid(1)), actor)).radicado).toBe("AB-000001");
    process.env.RADICADO_PREFIJO = "no válido!";
    expect((await crearRegistro(datos(uuid(2)), actor)).radicado).toBe("FV-000002");
  });

  it("consecutive records get consecutive radicados", async () => {
    expect((await crearRegistro(datos(uuid(1), "111111"), actor)).radicado).toBe("FV-000001");
    expect((await crearRegistro(datos(uuid(2), "222222"), actor)).radicado).toBe("FV-000002");
    expect(contador()).toBe(2);
  });

  it("retry with the same id returns the same radicado and consumes no number", async () => {
    const a = await crearRegistro(datos(uuid(1)), actor);
    const reintento = await crearRegistro(datos(uuid(1)), actor);
    expect(reintento).toEqual({ id: uuid(1), radicado: a.radicado, creado: false, advertencias: [] });
    expect(contador()).toBe(1);
    expect((await crearRegistro(datos(uuid(2), "999999"), actor)).radicado).toBe("FV-000002");
  });

  it("another funcionario using the same id gets a conflict", async () => {
    await crearRegistro(datos(uuid(1)), actor);
    await expect(crearRegistro(datos(uuid(1)), { uid: "u2", rol: "usuario", correo: "x@cali.gov.co" })).rejects.toBeInstanceOf(
      RegistroConflictoError,
    );
    expect(contador()).toBe(1);
  });

  it("concurrent creates never share or skip a number", async () => {
    const r = await Promise.all([1, 2, 3, 4, 5].map((n) => crearRegistro(datos(uuid(n), `${n}00000${n}`), actor)));
    expect(r.map((x) => x.radicado).sort()).toEqual(["FV-000001", "FV-000002", "FV-000003", "FV-000004", "FV-000005"]);
    expect(contador()).toBe(5);
  });

  it("a contended counter re-runs the transaction and takes the next free number", async () => {
    antesDeConfirmar = () => escribir("contadores/radicado", { ultimo: 5 }); // another writer committed first
    const r = await crearRegistro(datos(uuid(1)), actor);
    expect(r.radicado).toBe("FV-000006");
    expect(contador()).toBe(6);
    expect([...store.keys()].filter((k) => k.includes("/historial/"))).toHaveLength(1);
  });

  it("concurrent retries of the SAME id create one record and one radicado", async () => {
    const r = await Promise.all([crearRegistro(datos(uuid(1)), actor), crearRegistro(datos(uuid(1)), actor)]);
    expect(r.map((x) => x.radicado)).toEqual(["FV-000001", "FV-000001"]);
    expect(r.filter((x) => x.creado)).toHaveLength(1);
    expect(contador()).toBe(1);
  });

  it("propagates unexpected errors", async () => {
    antesDeConfirmar = () => {
      throw new Error("boom");
    };
    await expect(crearRegistro(datos(), actor)).rejects.toThrow("boom");
  });

  it("warns about a duplicate document without blocking; the internal id only for admin+", async () => {
    await crearRegistro(datos(uuid(1)), actor);
    const u = await crearRegistro(datos(uuid(2)), actor);
    expect(u.creado).toBe(true);
    expect(u.advertencias).toEqual([
      { tipo: "documento_duplicado", coincidencia: "exacta", radicado: "FV-000001", fecha_registro_bogota: expect.any(String) },
    ]);
    const a = await crearRegistro(datos(uuid(3)), admin);
    expect(a.advertencias[0]).toMatchObject({ id_existente: expect.any(String) });
  });
});

describe("buscarDuplicados", () => {
  beforeEach(async () => {
    await crearRegistro(datos(uuid(1), "1.234.567"), actor); // cc 1234567
  });

  it("matches the same number whatever the tipo and a digits-only variant as 'similar'", async () => {
    expect((await buscarDuplicados("1234567"))[0]).toMatchObject({ id: uuid(1), radicado: "FV-000001", coincidencia: "exacta" });
    expect((await buscarDuplicados("CC-1234567"))[0]).toMatchObject({ coincidencia: "similar" });
    expect((await buscarDuplicados("0001234567"))[0]).toMatchObject({ coincidencia: "similar" });
  });

  it("excludes the record itself, ignores other numbers, empty input and short digit runs", async () => {
    expect(await buscarDuplicados("1234567", { excluirId: uuid(1) })).toEqual([]);
    expect(await buscarDuplicados("7654321")).toEqual([]);
    expect(await buscarDuplicados("  ---  ")).toEqual([]);
    expect(await buscarDuplicados("CC1234")).toEqual([]);
  });

  it("exact matches come before similar ones", async () => {
    await crearRegistro(datos(uuid(2), "CC1234567"), actor);
    expect((await buscarDuplicados("1234567")).map((d) => d.coincidencia)).toEqual(["exacta", "similar"]);
  });
});

describe("POST /api/registros", () => {
  const req = (body: unknown) => new Request("http://x/api/registros", { method: "POST", body: JSON.stringify(body) });

  it("422 with dotted field errors and nothing written", async () => {
    requireSesion.mockResolvedValue(actor);
    const v = valido();
    v.solicitante.correo_solicitante = "malo";
    const res = await POST(req(v));
    expect(res.status).toBe(422);
    expect((await res.json()).campos).toHaveProperty("solicitante.correo_solicitante");
    expect([...store.keys()].filter((k) => k.startsWith("registros/"))).toHaveLength(0);
  });

  it("201 on create, 200 on idempotent retry with the same radicado", async () => {
    requireSesion.mockResolvedValue(actor);
    const a = await POST(req(valido()));
    expect(a.status).toBe(201);
    const b = await POST(req(valido()));
    expect(b.status).toBe(200);
    expect((await b.json()).radicado).toBe((await a.json()).radicado);
  });

  it("409 when the id belongs to another funcionario", async () => {
    requireSesion.mockResolvedValue(actor);
    await POST(req(valido()));
    requireSesion.mockResolvedValue({ uid: "u2", rol: "usuario", correo: "otra@cali.gov.co" });
    expect((await POST(req(valido()))).status).toBe(409);
  });

  it("creator, radicado and review status come from the session, never from the client payload", async () => {
    requireSesion.mockResolvedValue(actor);
    const body = {
      ...valido(),
      registrado_por_uid: "hacker",
      registrado_por_nombre: "Hacker",
      registrado_por_correo: "h@x.com",
      radicado: "FV-999999",
      estado_revision: "habilitado",
      estado: "anulado",
      documento_clave: "X",
    };
    expect((await POST(req(body))).status).toBe(201);
    expect(store.get(`registros/${valido().id}`)).toMatchObject({
      registrado_por_uid: "u1",
      registrado_por_nombre: "Ana Funcionaria",
      registrado_por_correo: actor.correo,
      radicado: "FV-000001",
      estado_revision: "pendiente_revision",
      estado: "registrado",
      documento_clave: "12345678",
    });
  });
});

describe("GET /api/registros/duplicado", () => {
  const get = (qs: string) => GETDuplicado(new Request(`http://x/api/registros/duplicado?${qs}`));
  beforeEach(async () => {
    await crearRegistro(datos(uuid(1), "1234567"), actor);
  });

  it("any approved funcionario sees radicado + date only", async () => {
    requireSesion.mockResolvedValue({ uid: "u9", rol: "usuario", correo: "otro@cali.gov.co" });
    const j = await (await get("tipo=ce&numero=1.234.567")).json();
    expect(j).toEqual({ existe: true, coincidencia: "exacta", cantidad: 1, radicado: "FV-000001", fecha_registro_bogota: expect.any(String) });
  });

  it("admin also sees who registered it and the status", async () => {
    requireSesion.mockResolvedValue(admin);
    expect(await (await get("numero=1234567")).json()).toMatchObject({
      registrado_por_nombre: "Ana Funcionaria",
      estado_revision: "pendiente_revision",
    });
  });

  it("no match, invalid number and no session", async () => {
    requireSesion.mockResolvedValue(actor);
    expect(await (await get("numero=999999999")).json()).toEqual({ existe: false });
    expect((await get("numero=---")).status).toBe(422);
    expect((await get("")).status).toBe(422);
    const { SesionError } = await import("@/modules/auth/server/sesion");
    requireSesion.mockRejectedValue(new SesionError(401, "No autenticado"));
    expect((await get("numero=1234567")).status).toBe(401);
  });

  it("an unknown tipo is ignored (informative only)", async () => {
    requireSesion.mockResolvedValue(actor);
    expect((await (await get("tipo=zzz&numero=1234567")).json()).existe).toBe(true);
  });
});

describe("listarRegistros / GET /api/registros", () => {
  const ts = (s: number) => ({ seconds: s, nanoseconds: 5, toDate: () => new Date(s * 1000) });
  const sembrar = (n: number, por = "u1") =>
    store.set(`registros/${uuid(n)}`, {
      radicado: `FV-00000${n}`,
      registrado_por_uid: por,
      registrado_por_nombre: "Ana Funcionaria",
      estado: "registrado",
      estado_revision: "pendiente_revision",
      registrado_en: ts(1000 + n),
      nombre_busqueda: `nombre ${n}`,
      fecha_registro_bogota: "2026-03-05",
      solicitante: { nombre_completo: `Nombre ${n}`, tipo_documento: "cc", numero_documento: `${n}`, foto_frente: "SECRETO", edad: 40 },
      inmueble: { nombre_barrio_vereda: "Aguacatal", nombre_division: "Comuna 1", estrato: 3 },
      firma: "SECRETO",
    });
  const get = (qs = "") => GETLista(new Request(`http://x/api/registros?${qs}`));
  beforeEach(() => [1, 2, 3].forEach((n) => sembrar(n)));

  it("pages with an opaque cursor and returns minimal columns only", async () => {
    const p = await listarRegistros({ limite: 2 }, admin);
    expect(p.items.map((i) => i.radicado)).toEqual(["FV-000001", "FV-000002"]); // fake keeps insertion order
    expect(p.siguiente).toEqual(expect.any(String));
    expect(Object.keys(p.items[0]).sort()).toEqual(
      ["barrio", "comuna", "estado", "estado_revision", "estrato", "id", "nombre", "numero_documento", "radicado", "registrado_en", "registrado_por_nombre", "tipo_documento"],
    );
    expect(JSON.stringify(p)).not.toContain("SECRETO");
    const ultima = await listarRegistros({ limite: 3 }, admin);
    expect(ultima.siguiente).toBeNull();
  });

  it("applies newest-first order, a stable tiebreak, the limit+1 probe and the cursor to the query", async () => {
    const p = await listarRegistros({ limite: 2 }, admin);
    expect(llamadas).toEqual(
      expect.arrayContaining([["orderBy", "registrado_en", "desc"], ["orderBy", "__name__", "desc"], ["limit", 3]]),
    );
    llamadas.length = 0;
    await listarRegistros({ limite: 2, cursor: JSON.parse(Buffer.from(p.siguiente!, "base64url").toString()) }, admin);
    const sa = llamadas.find((c) => c[0] === "startAfter")!;
    expect(sa[1]).toMatchObject({ seconds: 1002, nanoseconds: 5 });
    expect(sa[2]).toBe(uuid(2));
  });

  it("maps filters to equality, range and prefix clauses", async () => {
    await listarRegistros({ limite: 5, estado_revision: "habilitado", desde: "2026-03-05", nombre: undefined }, admin);
    expect(llamadas).toEqual(expect.arrayContaining([["where", "estado_revision", "==", "habilitado"], ["where", "registrado_en", ">=", expect.anything()]]));
    llamadas.length = 0;
    await listarRegistros({ limite: 5, nombre: "ana" }, admin);
    expect(llamadas).toEqual(expect.arrayContaining([["where", "nombre_busqueda", ">=", "ana"], ["orderBy", "nombre_busqueda", "asc"]]));
  });

  it("role scoping end to end: usuario only sees their own, admin sees all", async () => {
    sembrar(4, "u2");
    requireSesion.mockResolvedValue(actor);
    const mias = await (await get()).json();
    expect(mias.items).toHaveLength(3);
    expect(mias.items.map((i: any) => i.radicado)).not.toContain("FV-000004");
    // A usuario trying to read someone else's records through the funcionario filter is still scoped.
    expect((await (await get("registrado_por=u2")).json()).items.map((i: any) => i.radicado)).not.toContain("FV-000004");
    requireSesion.mockResolvedValue(admin);
    expect((await (await get()).json()).items).toHaveLength(4);
    expect((await (await get("registrado_por=u2")).json()).items).toHaveLength(1);
  });

  it("422 on invalid filters, 401 without session", async () => {
    requireSesion.mockResolvedValue(admin);
    const r = await get("limite=500&estado_revision=zzz");
    expect(r.status).toBe(422);
    expect(Object.keys((await r.json()).campos).sort()).toEqual(["estado_revision", "limite"]);
    const { SesionError } = await import("@/modules/auth/server/sesion");
    requireSesion.mockRejectedValue(new SesionError(401, "No autenticado"));
    expect((await get()).status).toBe(401);
  });
});

describe("obtenerRegistro / GET /api/registros/[id]", () => {
  const detalle = (id: string) => GETDetalle(new Request("http://x"), { params: Promise.resolve({ id }) });
  beforeEach(async () => {
    await crearRegistro(datos(uuid(1)), actor);
    store.get(`registros/${uuid(1)}`)!.foto_frente = "SECRETO";
  });

  it("owner and admin get the whitelisted record with historial; never the photo fields", async () => {
    requireSesion.mockResolvedValue(actor);
    const res = await detalle(uuid(1));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toMatchObject({ radicado: "FV-000001", estado_revision: "pendiente_revision", registrado_por_nombre: "Ana Funcionaria" });
    expect(j.datos.solicitante.nombre_completo).toBe("Ana María Pérez");
    expect(j.historial).toHaveLength(1);
    expect(j.historial[0]).not.toHaveProperty("por_uid");
    expect(JSON.stringify(j)).not.toContain("SECRETO");
    requireSesion.mockResolvedValue(admin);
    expect((await detalle(uuid(1))).status).toBe(200);
  });

  it("another usuario gets 404 (existence not leaked); unknown or malformed ids too", async () => {
    requireSesion.mockResolvedValue({ uid: "u2", rol: "usuario", correo: "x@cali.gov.co" });
    expect((await detalle(uuid(1))).status).toBe(404);
    expect(await obtenerRegistro(uuid(9), admin)).toBeNull();
    expect((await detalle("../x")).status).toBe(404);
  });
});
