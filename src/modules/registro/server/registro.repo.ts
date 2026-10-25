import { FieldValue } from "firebase-admin/firestore";
import { calcularEdad } from "@/modules/composicion/domain/derivaciones";
import { tieneRol, type Rol } from "@/modules/auth/domain/roles";
import { adminDb } from "@/shared/firebase/admin";
import { fechaBogota } from "@/shared/tiempo";
import type { RegistroDatos } from "../domain/schema";

export type Advertencia =
  | { tipo: "menor_de_edad"; edad: number }
  | { tipo: "documento_duplicado"; id_existente?: string };

export type ResultadoCreacion = { id: string; creado: boolean; advertencias: Advertencia[] };

/** Thrown when the id exists but belongs to another funcionario (not a retry of the same submit). */
export class RegistroConflictoError extends Error {}

const col = () => adminDb().collection("registros");

const yaExiste = (e: unknown) => {
  const c = (e as { code?: unknown }).code;
  return c === 6 || c === "already-exists";
};

/**
 * Creates registros/{id}. Idempotent: `create()` fails if the id exists, and a retry by the same
 * funcionario returns the existing record instead of a duplicate. Derived fields already come from the schema.
 */
export async function crearRegistro(datos: RegistroDatos, actor: { uid: string; rol: Rol }): Promise<ResultadoCreacion> {
  const { id, ...dominios } = datos;
  const ref = col().doc(id);
  const hoy = fechaBogota();

  const advertencias: Advertencia[] = [];
  const edad = calcularEdad(datos.solicitante.fecha_nacimiento, hoy);
  if (edad < 18) advertencias.push({ tipo: "menor_de_edad", edad });

  // Duplicate document is a warning, never a block. The existing id is only revealed to admin+.
  const dup = await col()
    .where("solicitante.numero_documento", "==", datos.solicitante.numero_documento)
    .where("solicitante.tipo_documento", "==", datos.solicitante.tipo_documento)
    .limit(2)
    .get();
  const otro = dup.docs.find((d) => d.id !== id);
  if (otro) advertencias.push({ tipo: "documento_duplicado", ...(tieneRol(actor.rol, "admin") ? { id_existente: otro.id } : {}) });

  const batch = adminDb().batch();
  batch.create(ref, {
    id,
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
    registrado_en: FieldValue.serverTimestamp(),
    fecha_registro_bogota: hoy,
    fuente: "app",
    version_esquema: 1,
    id_usuario_registro: actor.uid,
    // 'registrado' = initial state per design; no completeness gate until phase 3 (photos/signature/consent).
    estado: "registrado",
    ...dominios,
    solicitante: { ...dominios.solicitante, edad },
  });
  // Phase 3: adjuntos/{tipo} docs go in this same batch. Phase 4: counter increments too.
  try {
    await batch.commit();
  } catch (e) {
    if (!yaExiste(e)) throw e;
    const existente = await ref.get();
    if (existente.data()?.id_usuario_registro !== actor.uid) throw new RegistroConflictoError("Identificador en uso");
    return { id, creado: false, advertencias: [] };
  }
  return { id, creado: true, advertencias };
}
