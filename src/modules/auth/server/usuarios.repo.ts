import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/shared/firebase/admin";
import type { Rol } from "../domain/roles";

export type Usuario = {
  correo: string;
  nombre: string;
  rol: Rol;
  esta_aprobado: boolean;
  proveedor: "password" | "google";
};

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
      const { nombre, correo, rol, esta_aprobado } = d.data() as Usuario;
      return { uid: d.id, nombre, correo, rol, esta_aprobado };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Creates the users doc. Approved ones record who approved them (admin-created). */
export async function crearUsuario(uid: string, u: Usuario, aprobador?: string) {
  await col()
    .doc(uid)
    .create({
      ...u,
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
    aprobado_en: FieldValue.serverTimestamp(),
    id_usuario_aprobador: aprobador,
    actualizado_en: FieldValue.serverTimestamp(),
  });
  await auditar(uid, "aprobado", aprobador, rol);
}

/** Append-only record of who changed whom and when (AUTH-8). */
async function auditar(uid: string, accion: string, actor: string | undefined, rol: Rol) {
  await col().doc(uid).collection("auditoria").add({
    accion,
    rol,
    id_usuario_actor: actor ?? null,
    en: FieldValue.serverTimestamp(),
  });
}
