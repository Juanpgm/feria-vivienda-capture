"use client";

// 3-step form of the postulación (S5). Lean on purpose: it reuses the shared fields, photo capture and signature of the
// registro form, but not its Stepper (that one is bound to the registro drafts and routes).
import { del, get, set as guardar } from "idb-keyval";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormProvider, set, useForm, type FieldErrors, type FieldValues, type Resolver } from "react-hook-form";
import { TIPOS_FOTO } from "@/modules/documentos/domain/imagen";
import { FOTO_CAPTURADA } from "@/modules/documentos/domain/schema";
import { cargarFoto, descartarFotos } from "@/modules/documentos/ui/fotos";
import { aBase64 } from "@/modules/documentos/ui/subirAdjuntos";
import { firmaParaEnviar } from "@/modules/firma/domain/schema";
import { ModoContext } from "@/modules/registro/ui/modo";
import { fechaHoraBogota } from "@/shared/tiempo";
import { Button } from "@/shared/ui/Button";
import { validarSecciones, type Valores } from "../domain/armar";
import { ESTADOS_POSTULACION } from "../domain/catalogos";
import type { Seccion } from "../domain/schema";
import { valoresIniciales } from "../domain/formulario";
import { PasoHogar } from "./PasoHogar";
import { PasoSolicitante } from "./PasoSolicitante";
import { PasoSubsidio } from "./PasoSubsidio";

const PASOS = [
  { id: "solicitante", titulo: "Datos del solicitante", descripcion: "Quién se postula (jefe del hogar), dónde vive y las fotos de su documento.", secciones: ["solicitante", "documentos"] },
  { id: "hogar", titulo: "Grupo familiar", descripcion: "Las personas que viven con usted y sus ingresos.", secciones: ["hogar"] },
  { id: "subsidio", titulo: "Subsidio y cierre financiero", descripcion: "La modalidad, el proyecto de vivienda y los recursos con que cuenta. Al final, autorice y firme.", secciones: ["postulacion", "consentimiento", "declaracion", "firma"] },
] as const satisfies readonly { id: string; titulo: string; descripcion: string; secciones: readonly Seccion[] }[];

type Borrador = { id: string; paso: number; maximo: number; valores: Valores; guardado_en: string };
const claveBorrador = (uid: string, documento: string) => `postulacion:${uid}:${documento}`;

export type Edicion = { id: string; radicado: string; valores: Valores };
type Resultado = { id: string; radicado: string; nombre: string; en: string };

/** Loads the device draft for this document (a blank one otherwise), then mounts the form. */
export function FormularioPostulacion({ uid, documento, tipoDocumento, publico, edicion }: { uid: string; documento: string; tipoDocumento?: string; publico: boolean; edicion?: Edicion }) {
  const nuevo = (): Borrador => ({ id: crypto.randomUUID(), paso: 0, maximo: edicion ? PASOS.length - 1 : 0, valores: edicion?.valores ?? valoresIniciales(documento, tipoDocumento), guardado_en: "" });
  const [inicial, setInicial] = useState<Borrador | null>(() => (edicion ? nuevo() : null));
  useEffect(() => {
    if (edicion) return;
    get<Borrador>(claveBorrador(uid, documento))
      .catch(() => undefined)
      .then((b) => setInicial(b ? { ...b, valores: { ...valoresIniciales(documento, tipoDocumento), ...b.valores } } : nuevo()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `nuevo` only reads these same props
  }, [uid, documento, tipoDocumento, edicion]);
  if (!inicial) return <p role="status">Cargando…</p>;
  return (
    <ModoContext.Provider value={{ ciudadano: publico, edicion: false }}>
      <Formulario uid={uid} documento={documento} inicial={inicial} publico={publico} edicion={edicion} />
    </ModoContext.Provider>
  );
}

function Formulario({ uid, documento, inicial, publico, edicion }: { uid: string; documento: string; inicial: Borrador; publico: boolean; edicion?: Edicion }) {
  const router = useRouter();
  const [indice, setIndice] = useState(inicial.paso);
  const [maximo, setMaximo] = useState(inicial.maximo);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const terminado = useRef(false);
  const paso = PASOS[indice];
  // On edit the consent, declaration and signature already exist; photos are optional replacements.
  const secciones = (edicion ? paso.secciones.filter((s) => s !== "consentimiento" && s !== "declaracion" && s !== "firma" && s !== "documentos") : paso.secciones) as Seccion[];

  const resolver: Resolver<FieldValues> = async (valores) => {
    const planos = validarSecciones(valores as Valores, secciones);
    const errors: FieldErrors = {};
    for (const [ruta, message] of Object.entries(planos)) set(errors, ruta, { type: "validation", message });
    return Object.keys(planos).length ? { values: {}, errors } : { values: valores, errors: {} };
  };
  const form = useForm<FieldValues>({ defaultValues: inicial.valores, resolver, mode: "onTouched" });
  const { subscribe, getValues, trigger } = form;

  // Autosave on this device (1 s debounce); never for edits, whose source of truth is the server.
  useEffect(() => {
    if (edicion) return;
    let t: ReturnType<typeof setTimeout>;
    const escribir = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!terminado.current) void guardar(claveBorrador(uid, documento), { id: inicial.id, paso: indice, maximo, valores: getValues(), guardado_en: new Date().toISOString() }).catch(() => undefined);
      }, 1000);
    };
    escribir(); // the step position changed
    const dejar = subscribe({ formState: { values: true }, callback: escribir });
    return () => {
      clearTimeout(t);
      dejar();
    };
  }, [subscribe, getValues, uid, documento, inicial.id, indice, maximo, edicion]);

  function irA(i: number) {
    setIndice(i);
    setMaximo((m) => Math.max(m, i));
    setAviso("");
    window.scrollTo({ top: 0 });
  }

  async function siguiente() {
    if (await trigger()) irA(indice + 1);
    else {
      setAviso("Revise los campos marcados antes de continuar.");
      requestAnimationFrame(() => document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus());
    }
  }

  async function enviar() {
    if (!(await trigger())) {
      setAviso("Revise los campos marcados antes de enviar.");
      return;
    }
    setEnviando(true);
    setAviso("");
    try {
      const v = getValues() as Valores;
      const adjuntos: Record<string, string> = {};
      for (const tipo of TIPOS_FOTO) {
        if (v.documentos?.[tipo] !== FOTO_CAPTURADA) continue;
        const foto = await cargarFoto(inicial.id, tipo).catch(() => undefined);
        if (foto) adjuntos[tipo] = await aBase64(foto.blob);
        else if (!edicion) throw new Error("La foto del documento ya no está en este equipo. Tómela de nuevo.");
      }
      if (!edicion && v.firma?.metodo_firma === "dibujada") adjuntos.firma = String(v.firma.imagen);
      const { documentos: _d, firma, ...resto } = v; // eslint-disable-line @typescript-eslint/no-unused-vars
      const valores = edicion ? resto : { ...resto, firma: firmaParaEnviar(firma ?? {}) };
      const res = await fetch(edicion ? `/api/postulaciones/${edicion.id}` : "/api/postulaciones", {
        method: edicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valores, adjuntos }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const campos = j?.campos as Record<string, string[]> | undefined;
        for (const [ruta, m] of Object.entries(campos ?? {})) form.setError(ruta, { type: "server", message: m[0] });
        throw new Error(res.status === 409 && j?.radicado ? `Ya existe la postulación ${j.radicado} para este documento.` : (j?.error ?? "No se pudo enviar. Intente de nuevo."));
      }
      terminado.current = true;
      await Promise.all([del(claveBorrador(uid, documento)), descartarFotos(inicial.id)]).catch(() => undefined);
      if (edicion) {
        router.push(`/postulaciones/${edicion.id}`);
        router.refresh();
        return;
      }
      const s = v.solicitante;
      setResultado({ id: j.id, radicado: j.radicado, nombre: `${s.nombres} ${s.apellidos}`, en: new Date().toISOString() });
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) return <Confirmacion r={resultado} publico={publico} />;

  return (
    <FormProvider {...form}>
      <div className="mx-auto max-w-3xl">
        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Pasos de la postulación">
          {PASOS.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={i > maximo || enviando}
                aria-current={i === indice ? "step" : undefined}
                onClick={() => irA(i)}
                className="flex min-h-11 w-full flex-col items-start rounded-lg text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={`h-2 w-full rounded-full ${i <= indice ? "bg-primary" : "bg-border"}`} />
                <span className={`mt-1 text-sm ${i === indice ? "font-bold" : "font-semibold text-muted"}`}>
                  {i + 1}. {p.titulo}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {edicion && <p className="mb-2 text-sm font-semibold text-muted">Editando la postulación {edicion.radicado}</p>}
        <h2 className="text-2xl font-bold text-primary-strong">{paso.titulo}</h2>
        <p className="mb-6 mt-1 text-muted">{paso.descripcion}</p>

        <form noValidate onSubmit={(e) => e.preventDefault()} className="pb-6">
          {indice === 0 && <PasoSolicitante borradorId={inicial.id} documentoFijo={!!documento} />}
          {indice === 1 && <PasoHogar />}
          {indice === 2 && <PasoSubsidio creacion={!edicion} />}
        </form>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg px-4 py-3 md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={indice === 0 || enviando} onClick={() => irA(indice - 1)}>
            Atrás
          </Button>
          {indice < PASOS.length - 1 ? (
            <Button onClick={siguiente}>Siguiente</Button>
          ) : (
            <Button onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : edicion ? "Guardar cambios" : "Enviar postulación"}
            </Button>
          )}
          {edicion && (
            <Link href={`/postulaciones/${edicion.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
              Cancelar
            </Link>
          )}
          <p role="status" className="basis-full text-sm font-medium md:flex-1 md:basis-auto md:text-right">
            {aviso}
          </p>
        </div>
      </div>
    </FormProvider>
  );
}

function Confirmacion({ r, publico }: { r: Resultado; publico: boolean }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <section aria-labelledby="conf-titulo" className="mx-auto flex max-w-xl flex-col gap-6 py-4">
      <div>
        <h2 id="conf-titulo" ref={titulo} tabIndex={-1} className="text-2xl font-bold text-primary-strong outline-none">
          Postulación registrada
        </h2>
        <p className="mt-1 text-muted">Guarde este número: con él puede consultar el estado de su postulación.</p>
      </div>
      <div className="border-l-4 border-accent pl-4">
        <p className="text-sm font-semibold text-muted">Número de registro</p>
        <p data-testid="radicado" className="text-5xl font-bold tabular-nums text-primary-strong">{r.radicado}</p>
      </div>
      <dl className="grid gap-1 sm:grid-cols-[10rem_1fr]">
        <dt className="text-sm text-muted">Postulante</dt>
        <dd className="font-medium">{r.nombre}</dd>
        <dt className="text-sm text-muted">Fecha y hora</dt>
        <dd className="font-medium">{fechaHoraBogota(r.en)}</dd>
        <dt className="text-sm text-muted">Estado</dt>
        <dd className="font-medium">{ESTADOS_POSTULACION.sin_validar}</dd>
      </dl>
      <p className="text-sm text-muted">Un funcionario de la Secretaría revisará sus datos y documentos para validar la postulación.</p>
      {!publico && (
        <Link href={`/postulaciones/${r.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
          Ver la postulación
        </Link>
      )}
    </section>
  );
}
