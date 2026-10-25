import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory double of the users collection; nothing touches a real project.
/* eslint-disable @typescript-eslint/no-explicit-any */
const store = new Map<string, Record<string, any>>();
const DELETE = Symbol("delete");

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "TS", delete: () => DELETE },
}));
const docRef = (path: string): any => ({
  get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
  update: async (d: Record<string, any>) => {
    const next = { ...store.get(path) };
    for (const [k, v] of Object.entries(d)) {
      if (v === DELETE) delete next[k];
      else next[k] = v;
    }
    store.set(path, next);
  },
  collection: (n: string) => ({ add: async (d: Record<string, any>) => void store.set(`${path}/${n}/${store.size}`, d) }),
});
vi.mock("@/shared/firebase/admin", () => ({
  adminDb: () => ({ collection: () => ({ doc: (id: string) => docRef(`usuarios/${id}`) }) }),
}));

import { aprobarUsuario, estadoDe, rechazarUsuario } from "./usuarios.repo";

const pendiente = { correo: "p@x.co", nombre: "Pat", rol: "usuario", esta_aprobado: false, estado: "pendiente" };
const actor = { uid: "adm", correo: "adm@cali.gov.co" };
const auditorias = () =>
  [...store.entries()].filter(([k]) => k.startsWith("usuarios/u1/auditoria/")).map(([, v]) => v);

describe("rechazarUsuario / aprobarUsuario transitions", () => {
  beforeEach(() => {
    store.clear();
    store.set("usuarios/u1", { ...pendiente });
  });

  it("pending -> rejected: records who, when, motivo, and one audit entry", async () => {
    expect(await rechazarUsuario("u1", actor, "  Sin vínculo con la Alcaldía  ")).toBe("rechazado");
    expect(store.get("usuarios/u1")).toMatchObject({
      esta_aprobado: false,
      estado: "rechazado",
      rechazado_en: "TS",
      rechazado_por_uid: "adm",
      rechazado_por_correo: "adm@cali.gov.co",
      motivo: "Sin vínculo con la Alcaldía",
    });
    expect(auditorias()).toEqual([
      expect.objectContaining({ accion: "rechazado", id_usuario_actor: "adm", motivo: "Sin vínculo con la Alcaldía" }),
    ]);
  });

  it("motivo is optional: stored as null", async () => {
    await rechazarUsuario("u1", actor, "   ");
    expect(store.get("usuarios/u1")?.motivo).toBeNull();
    expect(auditorias()[0]).not.toHaveProperty("motivo");
  });

  it("idempotent: a second rejection changes nothing and adds no audit entry", async () => {
    await rechazarUsuario("u1", actor, "uno");
    const antes = structuredClone(store.get("usuarios/u1"));
    expect(await rechazarUsuario("u1", { uid: "otro", correo: "o@x.co" }, "dos")).toBe("ya_rechazado");
    expect(store.get("usuarios/u1")).toEqual(antes);
    expect(auditorias()).toHaveLength(1);
  });

  it("never touches approved or missing users", async () => {
    store.set("usuarios/u1", { ...pendiente, esta_aprobado: true, estado: "aprobado" });
    expect(await rechazarUsuario("u1", actor)).toBe("aprobado");
    expect(store.get("usuarios/u1")?.estado).toBe("aprobado");
    expect(await rechazarUsuario("nadie", actor)).toBe("no_existe");
  });

  it("rejected -> approved clears the rejection fields and audits both steps", async () => {
    await rechazarUsuario("u1", actor, "motivo");
    await aprobarUsuario("u1", "usuario", "sup");
    const doc = store.get("usuarios/u1")!;
    expect(doc).toMatchObject({ esta_aprobado: true, estado: "aprobado", id_usuario_aprobador: "sup" });
    for (const k of ["rechazado_en", "rechazado_por_uid", "rechazado_por_correo", "motivo"]) {
      expect(doc).not.toHaveProperty(k);
    }
    expect(auditorias().map((a) => a.accion)).toEqual(["rechazado", "aprobado"]);
  });
});

describe("estadoDe", () => {
  it("derives the state, including legacy docs without `estado`", () => {
    expect(estadoDe({ esta_aprobado: true })).toBe("aprobado");
    expect(estadoDe({ esta_aprobado: false })).toBe("pendiente");
    expect(estadoDe({ esta_aprobado: false, estado: "rechazado" })).toBe("rechazado");
    expect(estadoDe({ esta_aprobado: true, estado: "rechazado" })).toBe("aprobado"); // approval wins
  });
});
