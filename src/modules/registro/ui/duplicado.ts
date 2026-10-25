// Pure copy/logic of the duplicate-document warning (step 1). The API reveals more to admin+ (who/status).
import { ESTADOS_REVISION } from "@/shared/constantes";

export type RespuestaDuplicado =
  | { existe: false }
  | {
      existe: true;
      coincidencia: "exacta" | "similar";
      cantidad: number;
      radicado: string;
      fecha_registro_bogota: string;
      registrado_por_nombre?: string;
      estado_revision?: string;
    };

export function mensajeDuplicado(r: Extract<RespuestaDuplicado, { existe: true }>): string {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(r.fecha_registro_bogota) ? r.fecha_registro_bogota.split("-").reverse().join("/") : r.fecha_registro_bogota;
  const partes = [
    r.coincidencia === "exacta"
      ? "Ya existe un registro con este documento."
      : "Ya existe un registro con un documento muy parecido (puede cambiar un prefijo o los ceros iniciales).",
    `Radicado ${r.radicado}, registrado el ${fecha}.`,
  ];
  if (r.cantidad > 1) partes.push(`Hay ${r.cantidad} registros con este documento.`);
  if (r.registrado_por_nombre) partes.push(`Registrado por ${r.registrado_por_nombre}.`);
  const estado = ESTADOS_REVISION[r.estado_revision as keyof typeof ESTADOS_REVISION];
  if (estado) partes.push(`Estado: ${estado}.`);
  return partes.join(" ");
}

/** Reads the endpoint answer defensively: anything unexpected means "no warning" (the check is advisory). */
export function leerRespuestaDuplicado(j: unknown): Extract<RespuestaDuplicado, { existe: true }> | null {
  const r = j as Partial<Extract<RespuestaDuplicado, { existe: true }>> | null;
  if (!r || r.existe !== true || typeof r.radicado !== "string" || typeof r.fecha_registro_bogota !== "string") return null;
  return {
    existe: true,
    coincidencia: r.coincidencia === "similar" ? "similar" : "exacta",
    cantidad: typeof r.cantidad === "number" && r.cantidad > 0 ? r.cantidad : 1,
    radicado: r.radicado,
    fecha_registro_bogota: r.fecha_registro_bogota,
    registrado_por_nombre: typeof r.registrado_por_nombre === "string" ? r.registrado_por_nombre : undefined,
    estado_revision: typeof r.estado_revision === "string" ? r.estado_revision : undefined,
  };
}
