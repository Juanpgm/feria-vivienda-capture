import { FieldPath, FieldValue, Timestamp, type Query } from "firebase-admin/firestore";
import { calcularEdad } from "@/modules/composicion/domain/derivaciones";
import { tieneRol, type Rol } from "@/modules/auth/domain/roles";
import { obtenerUsuario } from "@/modules/auth/server/usuarios.repo";
import { radicadoPrefijo } from "@/shared/config";
import { ESTADO_REVISION_INICIAL } from "@/shared/constantes";
import { normalizarBusqueda } from "@/shared/busqueda";
import { adminDb } from "@/shared/firebase/admin";
import { fechaBogota } from "@/shared/tiempo";
import { clavesDocumento, coincidencia, type Coincidencia } from "../domain/documento";
import { codificarCursor, construirConsulta, type Filtros } from "../domain/listado";
import { formatearRadicado } from "../domain/radicado";
import type { RegistroDatos } from "../domain/schema";

/** Shape of the stored record. v2: split names, registrado_por_*, radicado, estado_revision, documento_clave. */
export const VERSION_ESQUEMA = 2;

export type Actor = { uid: string; rol: Rol; correo: string };

/** `id_existente` (internal id) is only revealed to admin+; everyone approved gets radicado + date. */
export type Advertencia = {
  tipo: "documento_duplicado";
  coincidencia: Coincidencia;
  radicado: string;
  fecha_registro_bogota: string;
  id_existente?: string;
};

export type ResultadoCreacion = { id: string; radicado: string; creado: boolean; advertencias: Advertencia[] };

/** Thrown when the id exists but belongs to another funcionario (not a retry of the same submit). */
export class RegistroConflictoError extends Error {}

const col = () => adminDb().collection("registros");
const refContador = () => adminDb().collection("contadores").doc("radicado");

export type Duplicado = {
  id: string;
  radicado: string;
  fecha_registro_bogota: string;
  registrado_por_nombre: string;
  estado_revision: string;
  coincidencia: Coincidencia;
};

/**
 * Registros whose document number matches `numero` regardless of tipo_documento: exact (`documento_clave`) first,
 * then digits-only matches. Excludes `excluirId` (the record being created/retried). Newest first inside each group.
 */
export async function buscarDuplicados(numero: string, { excluirId }: { excluirId?: string } = {}): Promise<Duplicado[]> {
  const claves = clavesDocumento(numero);
  if (!claves.documento_clave) return [];
  const consultas = [col().where("documento_clave", "==", claves.documento_clave).limit(10).get()];
  if (claves.documento_digitos) consultas.push(col().where("documento_digitos", "==", claves.documento_digitos).limit(10).get());
  const vistos = new Map<string, Duplicado>();
  for (const snap of await Promise.all(consultas)) {
    for (const d of snap.docs) {
      if (d.id === excluirId || vistos.has(d.id)) continue;
      const x = d.data();
      const c = coincidencia(claves, x);
      if (!c) continue;
      vistos.set(d.id, {
        id: d.id,
        radicado: String(x.radicado ?? ""),
        fecha_registro_bogota: String(x.fecha_registro_bogota ?? ""),
        registrado_por_nombre: String(x.registrado_por_nombre ?? ""),
        estado_revision: String(x.estado_revision ?? ""),
        coincidencia: c,
      });
    }
  }
  const rango = (d: Duplicado) => (d.coincidencia === "exacta" ? 0 : 1);
  return [...vistos.values()].sort((a, b) => rango(a) - rango(b) || b.fecha_registro_bogota.localeCompare(a.fecha_registro_bogota));
}

/**
 * Creates registros/{id} (+ historial entry + radicado consecutive) in ONE transaction. Idempotent: a retry with the same
 * id by the same funcionario returns the same radicado and consumes no number. Creator fields come from the verified
 * session and the usuarios profile, never from the client payload. Derived fields already come from the schema.
 * `estado` is the lifecycle ("registrado"); `estado_revision` is the internal SGOV review, independent of it.
 */
export async function crearRegistro(datos: RegistroDatos, actor: Actor): Promise<ResultadoCreacion> {
  const { id, ...dominios } = datos;
  const ref = col().doc(id);
  const hoy = fechaBogota();
  const edad = calcularEdad(datos.solicitante.fecha_nacimiento, hoy); // >= 18: enforced by the schema

  // Duplicate document is a warning, never a block.
  const duplicados = await buscarDuplicados(datos.solicitante.numero_documento, { excluirId: id });
  const advertencias: Advertencia[] = duplicados.slice(0, 3).map((d) => ({
    tipo: "documento_duplicado",
    coincidencia: d.coincidencia,
    radicado: d.radicado,
    fecha_registro_bogota: d.fecha_registro_bogota,
    ...(tieneRol(actor.rol, "admin") ? { id_existente: d.id } : {}),
  }));

  // Denormalized once, so list/count per funcionario never needs a join. Name falls back to the email local part.
  const perfil = await obtenerUsuario(actor.uid);
  const nombre = perfil?.nombre?.trim() || actor.correo.split("@")[0];
  const prefijo = radicadoPrefijo();

  const r = await adminDb().runTransaction(async (tx) => {
    const [existente, contador] = await Promise.all([tx.get(ref), tx.get(refContador())]);
    if (existente.exists) {
      const x = existente.data();
      if (x?.registrado_por_uid !== actor.uid) throw new RegistroConflictoError("Identificador en uso");
      return { creado: false, radicado: String(x.radicado) };
    }
    const numero = ((contador.data()?.ultimo as number | undefined) ?? 0) + 1;
    const radicado = formatearRadicado(prefijo, numero);
    tx.set(refContador(), { ultimo: numero, actualizado_en: FieldValue.serverTimestamp() });
    tx.create(ref, {
      // Validated form data first: nothing in it can override the server-owned fields below.
      ...dominios,
      solicitante: { ...dominios.solicitante, edad },
      id,
      radicado,
      radicado_numero: numero,
      creado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
      registrado_en: FieldValue.serverTimestamp(),
      fecha_registro_bogota: hoy,
      fuente: "app",
      version_esquema: VERSION_ESQUEMA,
      registrado_por_uid: actor.uid,
      registrado_por_nombre: nombre,
      registrado_por_correo: actor.correo,
      // 'registrado' = initial lifecycle state; no completeness gate until phase 3 (photos/signature/consent).
      estado: "registrado",
      estado_revision: ESTADO_REVISION_INICIAL,
      estado_revision_en: FieldValue.serverTimestamp(),
      estado_revision_por_uid: actor.uid,
      estado_revision_por_correo: actor.correo,
      ...clavesDocumento(datos.solicitante.numero_documento),
      nombre_busqueda: normalizarBusqueda(datos.solicitante.nombre_completo),
    });
    tx.create(ref.collection("historial").doc(), {
      tipo: "creacion",
      estado_revision: ESTADO_REVISION_INICIAL,
      por_uid: actor.uid,
      por_nombre: nombre,
      por_correo: actor.correo,
      en: FieldValue.serverTimestamp(),
    });
    // Phase 3: adjuntos/{tipo} docs go in this same transaction.
    return { creado: true, radicado };
  });
  return { id, radicado: r.radicado, creado: r.creado, advertencias: r.creado ? advertencias : [] };
}

// ---- List / detail (read side). Whitelisted fields only: photos and signature never leave the server. ----

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const aIso = (t: unknown): string | null => (t && typeof (t as Timestamp).toDate === "function" ? (t as Timestamp).toDate().toISOString() : null);

/** Highest code point: `>= p` and `< p + FIN_PREFIJO` is the Firestore idiom for "starts with p". */
const FIN_PREFIJO = String.fromCharCode(0xf8ff);

const CAMPOS_LISTA = [
  "radicado",
  "estado",
  "estado_revision",
  "registrado_por_nombre",
  "registrado_en",
  "nombre_busqueda",
  "solicitante.nombre_completo",
  "solicitante.tipo_documento",
  "solicitante.numero_documento",
  "inmueble.nombre_barrio_vereda",
  "inmueble.nombre_division",
  "inmueble.estrato",
];

export type FilaRegistro = {
  id: string;
  radicado: string;
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  barrio: string;
  comuna: string;
  estrato: number;
  estado: string;
  estado_revision: string;
  registrado_por_nombre: string;
  registrado_en: string | null;
};

const fila = (id: string, d: Doc): FilaRegistro => ({
  id,
  radicado: d.radicado,
  nombre: d.solicitante?.nombre_completo,
  tipo_documento: d.solicitante?.tipo_documento,
  numero_documento: d.solicitante?.numero_documento,
  barrio: d.inmueble?.nombre_barrio_vereda,
  comuna: d.inmueble?.nombre_division,
  estrato: d.inmueble?.estrato,
  estado: d.estado,
  estado_revision: d.estado_revision,
  registrado_por_nombre: d.registrado_por_nombre,
  registrado_en: aIso(d.registrado_en),
});

/** One page of registros, role-scoped by `construirConsulta` (a `usuario` only gets their own). */
export async function listarRegistros(f: Filtros, actor: { uid: string; rol: Rol }) {
  const c = construirConsulta(f, actor);
  let q: Query = col();
  for (const [campo, valor] of c.igualdad) q = q.where(campo, "==", valor);
  if (c.rangoFecha?.desde !== undefined) q = q.where("registrado_en", ">=", Timestamp.fromMillis(c.rangoFecha.desde));
  if (c.rangoFecha?.hasta !== undefined) q = q.where("registrado_en", "<", Timestamp.fromMillis(c.rangoFecha.hasta));
  if (c.prefijoNombre !== undefined) q = q.where("nombre_busqueda", ">=", c.prefijoNombre).where("nombre_busqueda", "<", c.prefijoNombre + FIN_PREFIJO);
  q = q.orderBy(c.orden, c.direccion).orderBy(FieldPath.documentId(), c.direccion);
  if (c.cursor) q = q.startAfter(typeof c.cursor.v === "string" ? c.cursor.v : new Timestamp(c.cursor.v[0], c.cursor.v[1]), c.cursor.id);
  const snap = await q.select(...CAMPOS_LISTA).limit(c.limite + 1).get();

  const hayMas = snap.docs.length > c.limite;
  const pagina = snap.docs.slice(0, c.limite);
  const ultimo = pagina.at(-1)?.data();
  const valor = c.orden === "nombre_busqueda" ? ultimo?.nombre_busqueda : ultimo?.registrado_en && [ultimo.registrado_en.seconds, ultimo.registrado_en.nanoseconds];
  return {
    items: pagina.map((d) => fila(d.id, d.data())),
    siguiente: hayMas && valor ? codificarCursor({ v: valor, id: pagina.at(-1)!.id }) : null,
  };
}

/** Full read-only record. Null (404) when missing OR not visible to the actor, so existence is not leaked. */
export async function obtenerRegistro(id: string, actor: { uid: string; rol: Rol }) {
  const ref = col().doc(id);
  const snap = await ref.get();
  const d = snap.data() as Doc | undefined;
  if (!d || (!tieneRol(actor.rol, "admin") && d.registrado_por_uid !== actor.uid)) return null;
  const hist = await ref.collection("historial").orderBy("en", "asc").limit(100).get();
  return {
    id,
    radicado: d.radicado,
    estado: d.estado,
    estado_revision: d.estado_revision,
    estado_revision_en: aIso(d.estado_revision_en),
    registrado_por_nombre: d.registrado_por_nombre,
    registrado_por_correo: d.registrado_por_correo,
    registrado_en: aIso(d.registrado_en),
    fecha_registro_bogota: d.fecha_registro_bogota,
    version_esquema: d.version_esquema,
    datos: {
      solicitante: d.solicitante,
      composicion: d.composicion,
      inmueble: d.inmueble,
      riesgo: d.riesgo,
      titularidad: d.titularidad,
      cierre_financiero: { ...d.cierre_financiero, observaciones: d.observaciones },
    },
    historial: hist.docs.map((h) => {
      const x = h.data();
      return { tipo: x.tipo, estado_revision: x.estado_revision, por_nombre: x.por_nombre, por_correo: x.por_correo, en: aIso(x.en) };
    }),
  };
}
