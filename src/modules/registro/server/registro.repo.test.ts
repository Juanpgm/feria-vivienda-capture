import { beforeEach, describe, expect, it, vi } from "vitest";

const commit = vi.fn();
const create = vi.fn();
const get = vi.fn();
let dupDocs: { id: string }[] = [];
const query = { where: () => query, limit: () => query, get: async () => ({ docs: dupDocs }) };
const doc = (id: string) => ({ id, get });
vi.mock("@/shared/firebase/admin", () => ({
  adminDb: () => ({ collection: () => ({ doc, ...query }), batch: () => ({ create, commit }) }),
}));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
const requireSesion = vi.fn();
vi.mock("@/modules/auth/server/sesion", async (orig) => ({ ...(await orig<object>()), requireSesion: (r: string) => requireSesion(r) }));

import { registroSchema } from "../domain/schema";
import { valido } from "../domain/fixture";
import { crearRegistro, RegistroConflictoError } from "./registro.repo";
import { POST } from "@/app/api/registros/route";

const datos = () => registroSchema.parse(valido());
const actor = { uid: "u1", rol: "usuario" as const };

beforeEach(() => {
  commit.mockReset();
  create.mockReset();
  get.mockReset();
  dupDocs = [];
});

describe("crearRegistro", () => {
  it("creates once with audit fields and attribution", async () => {
    const r = await crearRegistro(datos(), actor);
    expect(r).toMatchObject({ id: valido().id, creado: true, advertencias: [] });
    expect(create.mock.calls[0][1]).toMatchObject({
      id: valido().id,
      estado: "registrado",
      fuente: "app",
      version_esquema: 1,
      id_usuario_registro: "u1",
      registrado_en: "TS",
      creado_en: "TS",
      actualizado_en: "TS",
    });
    expect(create.mock.calls[0][1].solicitante.edad).toBeGreaterThanOrEqual(35);
  });

  it("retry by the same funcionario returns the existing record, another one gets a conflict", async () => {
    commit.mockRejectedValue({ code: 6 });
    get.mockResolvedValue({ data: () => ({ id_usuario_registro: "u1" }) });
    expect(await crearRegistro(datos(), actor)).toEqual({ id: valido().id, creado: false, advertencias: [] });
    await expect(crearRegistro(datos(), { uid: "u2", rol: "usuario" })).rejects.toBeInstanceOf(RegistroConflictoError);
  });

  it("propagates unexpected commit errors", async () => {
    commit.mockRejectedValue(new Error("boom"));
    await expect(crearRegistro(datos(), actor)).rejects.toThrow("boom");
  });

  it("warns about duplicate document (id only for admin+) and under-18, without blocking", async () => {
    dupDocs = [{ id: "otro" }];
    const d = datos();
    d.solicitante.fecha_nacimiento = "2015-01-01";
    const u = await crearRegistro(d, actor);
    expect(u.creado).toBe(true);
    expect(u.advertencias).toContainEqual({ tipo: "documento_duplicado" });
    expect(u.advertencias.some((a) => a.tipo === "menor_de_edad")).toBe(true);
    const a = await crearRegistro(datos(), { uid: "a1", rol: "admin" });
    expect(a.advertencias).toContainEqual({ tipo: "documento_duplicado", id_existente: "otro" });
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
    expect(commit).not.toHaveBeenCalled();
  });

  it("201 on create, 200 on idempotent retry", async () => {
    requireSesion.mockResolvedValue(actor);
    expect((await POST(req(valido()))).status).toBe(201);
    commit.mockRejectedValue({ code: 6 });
    get.mockResolvedValue({ data: () => ({ id_usuario_registro: "u1" }) });
    expect((await POST(req(valido()))).status).toBe(200);
  });
});
