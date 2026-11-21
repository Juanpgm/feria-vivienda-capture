import { describe, expect, it } from "vitest";
import { planearArchivos, type ArchivoManifiesto } from "./envio";

const foto = (ref: string, fila_id: string): ArchivoManifiesto => ({ ref, tipo: "foto", fila_id, content_type: "image/jpeg", bytes: 1000 });
const firma: ArchivoManifiesto = { ref: "firma", tipo: "firma_ciudadano", content_type: "image/png", bytes: 500 };
const visita = {
  atiende: { documento: "1144555" },
  diagnostico: { aplica: "si" as const },
  capitulos: [
    { filas: [{ id: "f1", item: "290304" }, { id: "f2", item: "APU 01" }] },
    { filas: [{ id: "f3", item: "290304" }] },
  ],
};

describe("planearArchivos", () => {
  it("assigns keys in visit row order, consecutive per ITEM, plus the citizen signature", () => {
    const r = planearArchivos("MV-000009", visita, [foto("a", "f3"), foto("b", "f1"), foto("c", "f1"), foto("d", "f2"), foto("e", "f2"), foto("g", "f3"), firma]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.archivos.map((a) => [a.ref, a.key.split("/").slice(2).join("/")])).toEqual([
      ["b", "registro-fotografico/MV-000009_290304_01.jpg"],
      ["c", "registro-fotografico/MV-000009_290304_02.jpg"],
      ["d", "registro-fotografico/MV-000009_APU-01_01.jpg"],
      ["e", "registro-fotografico/MV-000009_APU-01_02.jpg"],
      ["a", "registro-fotografico/MV-000009_290304_03.jpg"],
      ["g", "registro-fotografico/MV-000009_290304_04.jpg"],
      ["firma", "firma-ciudadano/MV-000009_1144555_01.png"],
    ]);
    expect(r.archivos[0].key.startsWith("visitas-profesionales/MV-000009/")).toBe(true);
  });

  it("rejects missing signature, duplicate refs, unknown rows and the photo limits", () => {
    const r = planearArchivos("MV-000009", visita, [foto("a", "f1"), foto("a", "f1"), foto("x", "nope")]);
    expect(r).toEqual({
      ok: false,
      errores: [
        "Hay archivos repetidos en el envío",
        "Se requiere una firma de quien atiende la visita",
        "Hay fotos de una actividad que no está en la visita",
        "Se requieren al menos 6 fotos por visita (hay 2)",
      ],
    });
  });

  it("a non-applicable visit only needs the signature", () => {
    const r = planearArchivos("MV-000010", { ...visita, diagnostico: { aplica: "no" }, capitulos: [] }, [firma]);
    expect(r.ok && r.archivos.map((a) => a.tipo)).toEqual(["firma_ciudadano"]);
  });
});
