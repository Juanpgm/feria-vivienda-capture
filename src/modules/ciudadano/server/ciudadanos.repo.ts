// Server-only. Collections (all deny-all for clients, Admin SDK only):
//   ciudadanos/{documento}      eligibility list loaded from the Excel + the citizen's own progress
//   configuracion/ciudadano     { habilitado } kill switch of the whole citizen link (fail closed when missing)
//   intentos_ciudadano/{ipHash} failed-login counter per IP (brute-force brake)
import { createHash, createHmac } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirebaseConfig } from "@/shared/config";
import { adminDb } from "@/shared/firebase/admin";

export type Ciudadano = {
  documento: string;
  nombre: string;
  formulario_rud?: string;
  /** Set when the registro is created; its id is deterministic per citizen (one registro per document, by construction). */
  registro_id?: string | null;
  radicado?: string;
  ediciones_usadas?: number;
  edicion_hash?: string;
  /** Photos/signature may be uploaded only while open: set on create and on edit, closed by `completar`. */
  adjuntos_abiertos?: boolean;
};

const colCiudadanos = () => adminDb().collection("ciudadanos");
export const refCiudadano = (documento: string) => colCiudadanos().doc(documento);

export async function obtenerCiudadano(documento: string): Promise<Ciudadano | null> {
  if (!/^[A-Z0-9]{4,20}$/.test(documento)) return null;
  const d = (await refCiudadano(documento).get()).data();
  return d ? ({ ...d, documento } as Ciudadano) : null;
}

// ---- link switch ----
const refConfig = () => adminDb().collection("configuracion").doc("ciudadano");

export async function enlaceHabilitado(): Promise<boolean> {
  return (await refConfig().get()).data()?.habilitado === true;
}

export async function fijarEnlace(habilitado: boolean, actor: { uid: string; correo: string }) {
  await refConfig().set({ habilitado, actualizado_en: FieldValue.serverTimestamp(), actualizado_por_uid: actor.uid, actualizado_por_correo: actor.correo }, { merge: true });
  await adminDb().collection("auditoria_enlace_ciudadano").add({ habilitado, por_uid: actor.uid, por_correo: actor.correo, en: FieldValue.serverTimestamp() });
}

export async function resumenCiudadanos() {
  const [habilitados, registrados] = await Promise.all([colCiudadanos().count().get(), colCiudadanos().where("registro_id", ">", "").count().get()]);
  return { habilitados: habilitados.data().count, registrados: registrados.data().count };
}

// ---- secrets derived from the service account (no extra env var to provision) ----
const derivar = (etiqueta: string) => createHmac("sha256", adminFirebaseConfig().privateKey).update(etiqueta).digest();
export const claveCookieCiudadano = () => derivar("sesion-ciudadano-v1");

/** Deterministic, unguessable RFC-4122 v4-shaped id: the registro of a citizen can only ever exist once. */
export function registroIdDe(documento: string): string {
  const h = createHmac("sha256", derivar("registro-ciudadano-v1")).update(documento).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// ---- login brake: LIMITE failed attempts per IP per VENTANA ----
const LIMITE = 20;
const VENTANA_MS = 15 * 60_000;
const refIntentos = (ip: string) => adminDb().collection("intentos_ciudadano").doc(createHash("sha256").update(ip).digest("hex").slice(0, 32));

export async function ipBloqueada(ip: string, ahora = Date.now()): Promise<boolean> {
  const d = (await refIntentos(ip).get()).data();
  return !!d && d.n >= LIMITE && ahora - d.desde < VENTANA_MS;
}

export async function registrarFallo(ip: string, ahora = Date.now()) {
  const ref = refIntentos(ip);
  await adminDb().runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    tx.set(ref, !d || ahora - d.desde >= VENTANA_MS ? { n: 1, desde: ahora } : { n: d.n + 1, desde: d.desde });
  });
}
