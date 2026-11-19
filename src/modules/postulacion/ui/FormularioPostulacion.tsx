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
import { SIGUIENTES_PASOS, SIGUIENTES_PASOS_TITULO } from "../domain/texto";
import type { Seccion } from "../domain/schema";
import { valoresIniciales } from "../domain/formulario";
import { enfocarCampo, pasoDeCampo, PorCompletar } from "./PorCompletar";
import { BarraAvance } from "./Progreso";
import { PasoHogar } from "./PasoHogar";
import { PasoSolicitante } from "./PasoSolicitante";
import { PasoSubsidio } from "./PasoSubsidio";
import { QrPostulacion } from "./QrPostulacion";

const PASOS = [
  { id: "solicitante", corto: "Usted", titulo: "Datos del solicitante", descripcion: "Primero autorice el uso de sus datos. Luego, quién se postula como jefe del hogar, dónde vive y las fotos de su documento.", minutos: 5, secciones: ["consentimiento", "solicitante", "documentos"] },
  { id: "hogar", corto: "Su hogar", titulo: "Grupo familiar", descripcion: "Las personas que viven con usted y lo que ganan al mes. Si vive solo, siga al siguiente paso.", minutos: 3, secciones: ["hogar"] },
  { id: "subsidio", corto: "Vivienda y recursos", titulo: "Subsidio y cierre financiero", descripcion: "El subsidio que solicita, el proyecto y el dinero con que cuenta. Al final declara y firma.", minutos: 4, secciones: ["postulacion", "declaracion", "firma"] },
] as const satisfies readonly { id: string; corto: string; titulo: string; descripcion: string; minutos: number; secciones: readonly Seccion[] }[];

type Borrador = { id: string; paso: number; maximo: number; valores: Valores; guardado_en: string };
const claveBorrador = (uid: string, documento: string) => `postulacion:${uid}:${documento}`;

/** `campo`: field to open the edit on ("Completar" from the record): its step is shown and it gets the focus. */
export type Edicion = { id: string; radicado: string; valores: Valores; campo?: string };
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
  const [indice, setIndice] = useState(edicion?.campo ? pasoDeCampo(edicion.campo) : inicial.paso);
  const [maximo, setMaximo] = useState(inicial.maximo);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardadoEn, setGuardadoEn] = useState(inicial.guardado_en);
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
        if (terminado.current) return;
        const ahora = new Date().toISOString();
        void guardar(claveBorrador(uid, documento), { id: inicial.id, paso: indice, maximo, valores: getValues(), guardado_en: ahora }).then(() => setGuardadoEn(ahora), () => undefined);
      }, 1000);
    };
    escribir(); // the step position changed
    const dejar = subscribe({ formState: { values: true }, callback: escribir });
    return () => {
      clearTimeout(t);
      dejar();
    };
  }, [subscribe, getValues, uid, documento, inicial.id, indice, maximo, edicion]);

  // Opened from "Completar": focus that field once its step is rendered.
  useEffect(() => {
    if (edicion?.campo) enfocarCampo(edicion.campo);
  }, [edicion?.campo]);

  /** Jump to a missing field (its step first). */
  function irACampo(ruta: string) {
    const i = pasoDeCampo(ruta);
    if (i !== indice) {
      setIndice(i);
      setAviso("");
    }
    enfocarCampo(ruta);
  }

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
      // Drawn on screen or uploaded as an image: always a signature image, never a manual verification.
      const valores = edicion ? resto : { ...resto, firma: { ...firmaParaEnviar(firma ?? {}), origen: firma?.origen === "imagen" ? "imagen" : "pantalla" } };
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

  const hora = guardadoEn ? new Date(guardadoEn).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <FormProvider {...form}>
      <div className="mx-auto max-w-3xl">
        {/* Mobile first: steps and progress in one compact strip that stays on top while scrolling. */}
        <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border bg-bg/95 px-4 pb-3 pt-2 backdrop-blur md:-mx-6 md:px-6">
          <nav aria-label="Pasos de la postulación" className="mb-2">
            <ol className="flex items-start">
              {PASOS.map((p, i) => {
                const hecho = i < indice;
                const actual = i === indice;
                return (
                  <li key={p.id} className="flex flex-1 items-start last:flex-none">
                    <button
                      type="button"
                      disabled={i > maximo || enviando}
                      aria-current={actual ? "step" : undefined}
                      onClick={() => irA(i)}
                      className="group flex min-h-11 items-center gap-2 rounded-lg px-1 text-left disabled:cursor-not-allowed"
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-colors ${
                          actual ? "border-primary bg-primary text-on-primary ring-2 ring-primary/20"
                          : hecho ? "border-primary bg-bg text-primary group-hover:bg-surface"
                          : "border-border bg-bg text-muted"
                        }`}
                      >
                        {hecho ? "✓" : i + 1}
                      </span>
                      <span className={`text-xs leading-tight sm:text-sm ${actual ? "font-bold text-primary-strong" : hecho ? "font-semibold text-text" : "sr-only text-muted sm:not-sr-only"}`}>{p.corto}</span>
                    </button>
                    {i < PASOS.length - 1 && <span aria-hidden="true" className={`mx-1 mt-[1.35rem] h-0.5 min-w-3 flex-1 rounded-full ${i < indice ? "bg-primary" : "bg-border"}`} />}
                  </li>
                );
              })}
            </ol>
          </nav>
          <BarraAvance />
        </div>

          {edicion && <PorCompletar alIr={irACampo} />}
          <header className="mb-8 border-l-4 border-accent pl-4">
            {edicion && <p className="mb-1 text-sm font-semibold text-muted">Editando la postulación {edicion.radicado}</p>}
            <p className="text-sm font-semibold text-primary">Paso {indice + 1} de {PASOS.length}, unos {paso.minutos} minutos</p>
            <h2 className="mt-1 text-2xl font-bold text-primary-strong sm:text-3xl">{paso.titulo}</h2>
            <p className="mt-2 max-w-prose text-muted">{paso.descripcion}</p>
          </header>

          <form noValidate onSubmit={(e) => e.preventDefault()} className="pb-10">
            {indice === 0 && <PasoSolicitante borradorId={inicial.id} documentoFijo={!!documento} conAutorizacion={!edicion} />}
            {indice === 1 && <PasoHogar />}
            {indice === 2 && <PasoSubsidio creacion={!edicion} />}
          </form>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={indice === 0 || enviando} onClick={() => irA(indice - 1)}>
            Atrás
          </Button>
          {indice < PASOS.length - 1 ? (
            <Button onClick={siguiente} className="px-6">Siguiente</Button>
          ) : (
            <Button onClick={enviar} disabled={enviando} className="px-6">
              {enviando ? "Enviando…" : edicion ? "Guardar cambios" : "Enviar postulación"}
            </Button>
          )}
          {edicion && (
            <Link href={`/postulaciones/${edicion.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
              Cancelar
            </Link>
          )}
          <p role="status" className="basis-full text-sm md:flex-1 md:basis-auto md:text-right">
            {aviso ? <span className="font-semibold text-danger">{aviso}</span> : !edicion && hora ? <span className="text-muted">Guardado en este equipo a las {hora}</span> : null}
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
    <section aria-labelledby="conf-titulo" className="mx-auto flex max-w-lg flex-col gap-6 py-4">
      <div className="overflow-hidden rounded-xl border border-border bg-bg shadow-[0_18px_40px_-24px_rgb(0_54_95/0.55)]">
        <div className="relative bg-[#00365f] px-6 pb-6 pt-5 text-white">
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
          <h2 id="conf-titulo" ref={titulo} tabIndex={-1} className="text-xl font-bold outline-none">
            Postulación registrada
          </h2>
          <p className="mt-1 text-white/85">Constancia de radicación del Subsidio Distrital de Vivienda</p>
        </div>
        <div className="flex flex-col gap-5 p-6">
          <div>
            <p className="text-sm text-muted">Número de registro</p>
            <p data-testid="radicado" className="text-5xl font-bold tabular-nums tracking-tight text-primary-strong">{r.radicado}</p>
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Postulante</dt>
            <dd className="font-semibold">{r.nombre}</dd>
            <dt className="text-muted">Fecha y hora</dt>
            <dd className="font-semibold">{fechaHoraBogota(r.en)}</dd>
            <dt className="text-muted">Estado</dt>
            <dd className="font-semibold">{ESTADOS_POSTULACION.sin_validar}</dd>
          </dl>
        </div>
      </div>
      <QrPostulacion id={r.id} radicado={r.radicado} />
      <div>
        <h3 className="text-lg font-bold text-primary-strong">{SIGUIENTES_PASOS_TITULO}</h3>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
          {SIGUIENTES_PASOS.map((p, i) => (
            <li key={p} className={i === SIGUIENTES_PASOS.length - 1 ? "font-semibold text-warning-text" : ""}>{p}</li>
          ))}
          <li className="text-muted">Tome una foto de esta pantalla o guarde el código QR: con él consulta el estado cuando quiera.</li>
        </ol>
      </div>
      {!publico && (
        <Link href={`/postulaciones/${r.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
          Ver la postulación
        </Link>
      )}
    </section>
  );
}
