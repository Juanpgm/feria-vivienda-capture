// Server-only. Collections (deny-all for clients, Admin SDK only):
//   postulantes_subsidios_emergencia/{id}            one per document (id = HMAC of the document), + adjuntos/{tipo}, historial/*
//   validaciones_postulaciones_subsidio_emergencia/{codigo}  the signed validation by an official, + adjuntos/firma
//   contadores/radicado_postulaciones                 consecutive of the radicado (PSE-000001), never reused
//   configuracion/postulaciones                       { habilitado } kill switch of the public form (fail closed)
import { createHash, createHmac, randomBytes } from "node:crypto";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { obtenerUsuario } from "@/modules/auth/server/usuarios.repo";
import { hashConsentimiento } from "@/modules/consentimiento/server/hash";
import { derivar } from "@/modules/ciudadano/server/ciudadanos.repo";
import type { AdjuntoValidado } from "@/modules/documentos/server/adjuntos.repo";
import { formatearRadicado } from "@/modules/registro/domain/radicado";
import { adminDb } from "@/shared/firebase/admin";
import { fechaBogota, isoBogota } from "@/shared/tiempo";
import type { DatosPostulacion } from "../domain/armar";
import type { EstadoPostulacion } from "../domain/catalogos";
import type { Faltante } from "../domain/faltantes";
import type { FilaMetrica } from "../domain/metricas";
import { DECLARACION_VERSION, textoDeclaracion, textoValidacion, VALIDACION_VERSION } from "../domain/texto";

export const COLECCION = "postulantes_subsidios_emergencia";
export const COLECCION_VALIDACIONES = "validaciones_postulaciones_subsidio_emergencia";
export const PREFIJO_RADICADO = "PSE";

const db = () => adminDb();
const col = () => db().collection(COLECCION);
const refContador = () => db().collection("contadores").doc("radicado_postulaciones");
const refConfig = () => db().collection("configuracion").doc("postulaciones");

export class PostulacionError extends Error {
  constructor(
    readonly status: 404 | 409 | 422,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export type Actor = { uid: string; correo: string };
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

/** Deterministic, unguessable uuid-shaped id: one postulación per document, by construction. */
export function postulacionIdDe(documento: string): string {
  const h = createHmac("sha256", derivar("postulacion-subsidio-v1")).update(documento).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function nombreDe(actor: Actor) {
  const perfil = await obtenerUsuario(actor.uid);
  return perfil?.nombre?.trim() || actor.correo.split("@")[0];
}

// ---- public form switch ----
export async function formularioHabilitado(): Promise<boolean> {
  // e2e on the dev server only (never in a production build): opens the public page without touching the real switch.
  if (process.env.NODE_ENV !== "production" && process.env.E2E_POSTULACION_ABIERTA === "1") return true;
  return (await refConfig().get()).data()?.habilitado === true;
}
export async function fijarFormulario(habilitado: boolean, actor: Actor) {
  await refConfig().set({ habilitado, actualizado_en: FieldValue.serverTimestamp(), actualizado_por_uid: actor.uid, actualizado_por_correo: actor.correo }, { merge: true });
  await db().collection("auditoria_enlace_postulaciones").add({ habilitado, por_uid: actor.uid, por_correo: actor.correo, en: FieldValue.serverTimestamp() });
}

// ---- lookup (the first question of the form) ----
export type Consulta = { existe: false } | { existe: true; id: string; radicado: string; estado: EstadoPostulacion };

export async function consultarPorDocumento(documento: string): Promise<Consulta> {
  const id = postulacionIdDe(documento);
  const d = (await col().doc(id).get()).data();
  return d ? { existe: true, id, radicado: String(d.radicado), estado: d.estado as EstadoPostulacion } : { existe: false };
}

/** What the public may see of a postulación (its QR page): radicado, status and dates. Never personal data. */
export async function estadoPublico(id: string) {
  const d = (await col().doc(id).get()).data();
  return d ? { radicado: String(d.radicado), estado: d.estado as EstadoPostulacion, fecha_bogota: String(d.fecha_bogota ?? ""), validado_en: (d.validado_en as string | undefined) ?? null } : null;
}

const adjuntoDoc = (a: AdjuntoValidado, por: string) => ({
  tipo: a.tipo,
  mime: a.mime,
  bytes: a.datos.length,
  sha256: createHash("sha256").update(a.datos).digest("hex"),
  datos: a.datos,
  subido_en: FieldValue.serverTimestamp(),
  subido_por: por,
});

export type Envio = {
  datos: DatosPostulacion;
  faltantes: Faltante[];
  consentimiento: { acepta_tratamiento: true; acepta_datos_sensibles: boolean; version: string };
  firma: Record<string, unknown>;
  adjuntos: AdjuntoValidado[];
};

/**
 * Creates the postulación with its photos and signature in ONE transaction, so a record never exists without them (S16).
 * A second creation for the same document is a 409 that carries the existing radicado.
 */
export async function crearPostulacion(e: Envio, actor: Actor | null) {
  const id = postulacionIdDe(e.datos.solicitante.numero_documento);
  const ref = col().doc(id);
  const nombre = actor ? await nombreDe(actor) : null;
  const por = actor ? actor.correo : "ciudadano";
  return db().runTransaction(async (tx) => {
    const [existente, contador] = await Promise.all([tx.get(ref), tx.get(refContador())]);
    if (existente.exists) throw new PostulacionError(409, "Ya existe una postulación con este documento", { radicado: existente.data()?.radicado });
    const numero = ((contador.data()?.ultimo as number | undefined) ?? 0) + 1;
    const radicado = formatearRadicado(PREFIJO_RADICADO, numero);
    tx.set(refContador(), { ultimo: numero, actualizado_en: FieldValue.serverTimestamp() });
    tx.create(ref, {
      ...e.datos,
      id,
      radicado,
      radicado_numero: numero,
      estado: "sin_validar" satisfies EstadoPostulacion,
      faltantes: e.faltantes,
      completa: e.faltantes.length === 0,
      consentimiento: { ...e.consentimiento, hash: hashConsentimiento(), aceptado_en: FieldValue.serverTimestamp() },
      declaracion: { acepta: true, version: DECLARACION_VERSION, hash: sha(`${DECLARACION_VERSION}\n${textoDeclaracion()}`) },
      firma: e.firma,
      adjuntos: e.adjuntos.map((a) => a.tipo),
      origen: actor ? "funcionario" : "publico",
      creado_por_uid: actor?.uid ?? null,
      creado_por_nombre: nombre,
      creado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
      fecha_bogota: fechaBogota(),
    });
    for (const a of e.adjuntos) tx.set(ref.collection("adjuntos").doc(a.tipo), adjuntoDoc(a, por));
    tx.create(ref.collection("historial").doc(), { tipo: "creacion", por_uid: actor?.uid ?? null, por_nombre: nombre ?? "Ciudadano (formulario público)", en: FieldValue.serverTimestamp(), faltantes: e.faltantes.length });
    return { id, radicado };
  });
}

/** Staff edit while the record is not validated. New photos replace the stored ones; the rest are kept. */
export async function editarPostulacion(id: string, e: Omit<Envio, "consentimiento" | "firma"> & { firma?: Record<string, unknown> }, actor: Actor) {
  const ref = col().doc(id);
  const nombre = await nombreDe(actor);
  await db().runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    if (!d) throw new PostulacionError(404, "Postulación no encontrada");
    if (d.estado === "valido") throw new PostulacionError(409, "La postulación ya fue validada y no se puede modificar");
    if (d.solicitante?.numero_documento !== e.datos.solicitante.numero_documento) throw new PostulacionError(422, "El número de documento no se puede cambiar");
    tx.update(ref, {
      ...e.datos,
      faltantes: e.faltantes,
      completa: e.faltantes.length === 0,
      ...(e.firma ? { firma: e.firma } : {}),
      adjuntos: [...new Set([...(d.adjuntos ?? []), ...e.adjuntos.map((a) => a.tipo)])],
      actualizado_en: FieldValue.serverTimestamp(),
    });
    for (const a of e.adjuntos) tx.set(ref.collection("adjuntos").doc(a.tipo), adjuntoDoc(a, actor.correo));
    tx.create(ref.collection("historial").doc(), { tipo: "edicion", por_uid: actor.uid, por_nombre: nombre, en: FieldValue.serverTimestamp(), faltantes: e.faltantes.length });
  });
}

const aIso = (t: unknown) => ((t as Timestamp | undefined)?.toDate ? isoBogota((t as Timestamp).toDate()) : null);

/** Everything the unified per-person view shows (no image bytes). */
export async function obtenerPostulacion(id: string) {
  const ref = col().doc(id);
  const [snap, historial] = await Promise.all([ref.get(), ref.collection("historial").orderBy("en", "desc").limit(100).get()]);
  const d = snap.data();
  if (!d) return null;
  const validacion = d.validacion_codigo ? (await db().collection(COLECCION_VALIDACIONES).doc(String(d.validacion_codigo)).get()).data() : undefined;
  return {
    ...d,
    id,
    creado_en: aIso(d.creado_en),
    actualizado_en: aIso(d.actualizado_en),
    consentimiento: { ...d.consentimiento, aceptado_en: aIso(d.consentimiento?.aceptado_en) },
    historial: historial.docs.map((h) => ({ id: h.id, tipo: String(h.data().tipo), por_nombre: String(h.data().por_nombre ?? ""), en: aIso(h.data().en), faltantes: h.data().faltantes as number | undefined })),
    validacion: validacion ? { ...validacion, creado_en: aIso(validacion.creado_en) } : null,
  } as unknown as PostulacionVista;
}

export type Validacion = {
  codigo_validacion: string; funcionario_nombre: string; funcionario_correo: string; validado_en: string; folios_anexos: number | null; texto_version: string;
};
export type PostulacionVista = DatosPostulacion & {
  id: string; radicado: string; estado: EstadoPostulacion; faltantes: Faltante[]; origen: string; adjuntos: string[];
  firma: Record<string, unknown>; consentimiento: Record<string, unknown>; declaracion: Record<string, unknown>;
  creado_en: string | null; actualizado_en: string | null; creado_por_nombre: string | null;
  historial: { id: string; tipo: string; por_nombre: string; en: string | null; faltantes?: number }[];
  validacion: Validacion | null;
};

export type FilaPostulacion = {
  id: string; radicado: string; nombre: string; documento: string; modalidad: string; estado: EstadoPostulacion; faltantes: number; creado_en: string | null; origen: string;
};

/** Newest first. ponytail: one bounded scan (500) filtered in memory; paginate with a cursor when volume grows. */
export async function listarPostulaciones({ estado, q }: { estado?: string; q?: string } = {}): Promise<FilaPostulacion[]> {
  // Filtered in memory (no composite index to deploy).
  const snap = await col().orderBy("radicado_numero", "desc").limit(500).select("radicado", "solicitante.nombre_completo", "solicitante.numero_documento", "postulacion.modalidad", "estado", "faltantes", "creado_en", "origen").get();
  const filas = snap.docs.map((s) => {
    const d = s.data();
    return {
      id: s.id, radicado: String(d.radicado), nombre: String(d.solicitante?.nombre_completo ?? ""), documento: String(d.solicitante?.numero_documento ?? ""),
      modalidad: String(d.postulacion?.modalidad ?? ""), estado: d.estado as EstadoPostulacion, faltantes: Array.isArray(d.faltantes) ? d.faltantes.length : 0,
      creado_en: aIso(d.creado_en), origen: String(d.origen ?? ""),
    };
  });
  const t = q?.trim().toUpperCase();
  const porEstado = estado === "sin_validar" || estado === "valido" ? filas.filter((f) => f.estado === estado) : filas;
  return t ? porEstado.filter((f) => f.radicado.includes(t) || f.documento.includes(t.replace(/[^A-Z0-9]/g, "")) || f.nombre.toUpperCase().includes(t)) : porEstado;
}

/**
 * Admin+ only (checked by the route). Deletes the postulación with its photos, signature, history and access logs, and its
 * validation if any. The audit entry is written FIRST: if it cannot be written, nothing is deleted. The radicado is not
 * reused (the counter is left as is).
 */
export async function borrarPostulacion(id: string, motivo: string, actor: Actor) {
  const ref = col().doc(id);
  const d = (await ref.get()).data();
  if (!d) throw new PostulacionError(404, "Postulación no encontrada");
  await db().collection("auditoria_borrado_postulaciones").add({
    postulacion_id: id,
    radicado: d.radicado ?? null,
    documento: d.solicitante?.numero_documento ?? null,
    nombre: d.solicitante?.nombre_completo ?? null,
    estado: d.estado ?? null,
    validacion_codigo: d.validacion_codigo ?? null,
    motivo,
    por_uid: actor.uid,
    por_correo: actor.correo,
    por_nombre: await nombreDe(actor),
    en: FieldValue.serverTimestamp(),
  });
  if (d.validacion_codigo) await db().recursiveDelete(db().collection(COLECCION_VALIDACIONES).doc(String(d.validacion_codigo)));
  await db().recursiveDelete(ref);
  cache = null;
  return { radicado: String(d.radicado) };
}

// ponytail: per-instance 60 s cache of one projected full scan; move to counters when volume grows past a few thousand.
let cache: { en: number; filas: FilaMetrica[] } | null = null;
export async function filasMetricas(): Promise<FilaMetrica[]> {
  if (cache && Date.now() - cache.en < 60_000) return cache.filas;
  const snap = await col()
    .select("estado", "fecha_bogota", "origen", "faltantes", "solicitante.nombre_division", "solicitante.estrato", "solicitante.genero", "solicitante.condiciones_especiales",
      "solicitante.sisben", "solicitante.sisben_grupo", "solicitante.caja_compensacion", "hogar.personas", "hogar.rango_ingresos_smlmv", "postulacion.modalidad",
      "postulacion.recursos", "postulacion.total_aportes", "validado_por_nombre")
    .get();
  cache = { en: Date.now(), filas: snap.docs.map((d) => d.data() as FilaMetrica) };
  return cache.filas;
}

const CODIGO_ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export const nuevoCodigoValidacion = (radicadoNumero: number) =>
  `VAL-${String(radicadoNumero).padStart(6, "0")}-${[...randomBytes(6)].map((b) => CODIGO_ALFABETO[b % CODIGO_ALFABETO.length]).join("")}`;

/**
 * Validates a complete postulación (S13). One transaction: creates the validation record (signed by the official),
 * moves the postulación to "valido" and logs it. Refuses incomplete or already validated records.
 */
export async function validarPostulacion(id: string, v: { folios_anexos: number | null; firma: AdjuntoValidado }, actor: Actor, userAgent: string) {
  const ref = col().doc(id);
  const nombre = await nombreDe(actor);
  return db().runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    if (!d) throw new PostulacionError(404, "Postulación no encontrada");
    if (d.estado === "valido") throw new PostulacionError(409, "La postulación ya fue validada", { codigo: d.validacion_codigo });
    if (Array.isArray(d.faltantes) && d.faltantes.length) throw new PostulacionError(422, "La postulación tiene datos obligatorios sin completar", { faltantes: d.faltantes });
    const codigo = nuevoCodigoValidacion(Number(d.radicado_numero));
    const validadoEn = isoBogota();
    const refVal = db().collection(COLECCION_VALIDACIONES).doc(codigo);
    tx.create(refVal, {
      codigo_validacion: codigo,
      postulacion_id: id,
      radicado: d.radicado,
      documento_postulante: d.solicitante?.numero_documento ?? null,
      nombre_postulante: d.solicitante?.nombre_completo ?? null,
      funcionario_uid: actor.uid,
      funcionario_nombre: nombre,
      funcionario_correo: actor.correo,
      validado_en: validadoEn,
      creado_en: FieldValue.serverTimestamp(),
      folios_anexos: v.folios_anexos,
      confirmacion_paquete_completo: true,
      texto_version: VALIDACION_VERSION,
      texto_hash: sha(`${VALIDACION_VERSION}\n${textoValidacion()}`),
      firma_sha256: createHash("sha256").update(v.firma.datos).digest("hex"),
      user_agent: userAgent.slice(0, 200),
    });
    tx.set(refVal.collection("adjuntos").doc("firma"), adjuntoDoc(v.firma, actor.correo));
    tx.update(ref, { estado: "valido" satisfies EstadoPostulacion, validacion_codigo: codigo, validado_en: validadoEn, validado_por_nombre: nombre, actualizado_en: FieldValue.serverTimestamp() });
    tx.create(ref.collection("historial").doc(), { tipo: "validacion", por_uid: actor.uid, por_nombre: nombre, en: FieldValue.serverTimestamp(), codigo });
    return { codigo, validado_en: validadoEn, funcionario_nombre: nombre };
  });
}
