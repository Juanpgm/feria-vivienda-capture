import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/shared/firebase/admin";
import type { Rol } from "../domain/roles";

export type EstadoUsuario = "pendiente" | "aprobado" | "rechazado";

export type Usuario = {
  correo: string;
  nombre: string;
  rol: Rol;
  esta_aprobado: boolean;
  proveedor: "password" | "google";
  /** Absent on legacy docs: derived from esta_aprobado. */
  estado?: EstadoUsuario;
  rechazado_por_correo?: string;
  motivo?: string | null;
};

export const estadoDe = (u: Pick<Usuario, "esta_aprobado" | "estado">): EstadoUsuario =>
  u.esta_aprobado ? "aprobado" : u.estado === "rechazado" ? "rechazado" : "pendiente";

const col = () => adminDb().collection("usuarios");

export async function obtenerUsuario(uid: string): Promise<Usuario | null> {
  const s = await col().doc(uid).get();
  return s.exists ? (s.data() as Usuario) : null;
}

/** Admins see only `usuario` accounts; superadmins see everyone. */
export async function listarUsuarios(actor: Rol) {
  const q = actor === "superadmin" ? col() : col().where("rol", "==", "usuario");
  const snap = await q.limit(500).get();
  return snap.docs
    .map((d) => {
      const u = d.data() as Usuario & { rechazado_en?: { toDate(): Date } };
      const estado = estadoDe(u);
      return {
        uid: d.id,
        nombre: u.nombre,
        correo: u.correo,
        rol: u.rol,
        estado,
        ...(estado === "rechazado" && {
          rechazado_por_correo: u.rechazado_por_correo ?? null,
          rechazado_en: u.rechazado_en?.toDate().toISOString() ?? null,
          motivo: u.motivo ?? null,
        }),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Creates the users doc. Approved ones record who approved them (admin-created). */
export async function crearUsuario(uid: string, u: Usuario, aprobador?: string) {
  await col()
    .doc(uid)
    .create({
      ...u,
      estado: u.esta_aprobado ? "aprobado" : "pendiente",
      creado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
      ...(u.esta_aprobado ? { aprobado_en: FieldValue.serverTimestamp(), id_usuario_aprobador: aprobador ?? null } : {}),
    });
  if (u.esta_aprobado) await auditar(uid, "creado_aprobado", aprobador, u.rol);
}

export async function aprobarUsuario(uid: string, rol: Rol, aprobador: string) {
  await col().doc(uid).update({
    rol,
    esta_aprobado: true,
    estado: "aprobado",
    aprobado_en: FieldValue.serverTimestamp(),
    id_usuario_aprobador: aprobador,
    // Reconsidering a rejection clears it (the audit trail keeps the history).
    rechazado_en: FieldValue.delete(),
    rechazado_por_uid: FieldValue.delete(),
    rechazado_por_correo: FieldValue.delete(),
    motivo: FieldValue.delete(),
    actualizado_en: FieldValue.serverTimestamp(),
  });
  await auditar(uid, "aprobado", aprobador, rol);
}

export type ResultadoRechazo = "rechazado" | "ya_rechazado" | "aprobado" | "no_existe";

/**
 * Pending -> rejected. Keeps the doc and the Auth user (history). Idempotent: an already rejected user is left
 * untouched (no second audit entry). An approved user is not touched: revoking access is a different action.
 */
export async function rechazarUsuario(
  uid: string,
  actor: { uid: string; correo: string },
  motivo?: string,
): Promise<ResultadoRechazo> {
  const ref = col().doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return "no_existe";
  const u = snap.data() as Usuario;
  if (u.esta_aprobado) return "aprobado";
  if (u.estado === "rechazado") return "ya_rechazado";
  const texto = motivo?.trim() || null;
  await ref.update({
    esta_aprobado: false,
    estado: "rechazado",
    rechazado_en: FieldValue.serverTimestamp(),
    rechazado_por_uid: actor.uid,
    rechazado_por_correo: actor.correo,
    motivo: texto,
    actualizado_en: FieldValue.serverTimestamp(),
  });
  await auditar(uid, "rechazado", actor.uid, u.rol, texto);
  return "rechazado";
}

/** Append-only record of who changed whom and when (AUTH-8). */
async function auditar(uid: string, accion: string, actor: string | undefined, rol: Rol, motivo?: string | null) {
  await col().doc(uid).collection("auditoria").add({
    accion,
    rol,
    ...(motivo ? { motivo } : {}),
    id_usuario_actor: actor ?? null,
    en: FieldValue.serverTimestamp(),
  });
}
