"use client";

// 5-step field visit form (S1-S3, S6). Plain React state (dynamic chapters/rows/photos); each step validates with the
// shared visitaSchema. The draft autosaves on this device; photo bytes live in fotosVisita.ts.
import { del, get, set as guardar } from "idb-keyval";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PadFirma } from "@/modules/firma/ui/PadFirma";
import { fechaHoraBogota } from "@/shared/tiempo";
import { Button } from "@/shared/ui/Button";
import { Field, TextArea } from "@/shared/ui/Field";
import { ALCANCES, APLICA_PARA, NO_APLICA_POR, RELACIONES_ATIENDE, TIPOS_DOCUMENTO } from "../domain/catalogos";
import type { Apu } from "../domain/apus";
import type { UbicacionGps } from "../domain/envio";
import { erroresFotos } from "../domain/fotos";
import { OBSERVACIONES_MAX } from "../domain/visita";
import { aEntrada, conteosFotos, construirManifiesto, dataUrlAPng, erroresPaso, formatoCop, visitaVacia, type FotosPorFila, type Valores } from "./armado";
import { CampoSelect, CampoTexto, Segmentos } from "./campos";
import { enviarVisita, type ProgresoEnvio } from "./enviarVisita";
import { cargarFotoVisita, quitarFotosVisita } from "./fotosVisita";
import { PasoCantidades, presupuesto, useApus } from "./PasoCantidades";
import { PasoDiagnostico } from "./PasoDiagnostico";
import { IconoCheck } from "@/shared/ui/Iconos";

const PASOS = [
  { corto: "Anfitrión", titulo: "Anfitrión", descripcion: "Quién recibe al inspector en el predio y los datos del propietario." },
  { corto: "Diagnóstico", titulo: "Diagnóstico", descripcion: "Si la vivienda aplica al mejoramiento y el estado de cada elemento." },
  { corto: "Cantidades", titulo: "Cantidades de obra", descripcion: "Capítulos, actividades del listado de precios, cantidades medidas y fotos por actividad." },
  { corto: "Cierre", titulo: "Observaciones y firmas", descripcion: "Observaciones de la visita y firma de quien atiende." },
] as const;

/** `v` 2 = four steps (Anfitrión merged "Atiende" + "Propietario"); drafts without it used the old five steps.
 * `v` 3 = one state per house element (`diagnostico.estados` + `detalles`) instead of the old `secciones`. */
type Borrador = { v?: 2 | 3; valores: Valores; fotos: FotosPorFila; firma: string | null; paso: number; maximo: number; guardado_en: string };
function migrar(b: Borrador): Borrador {
  if (b.v === 3) return b;
  const pasos = b.v === 2 ? b : { ...b, paso: Math.max(0, b.paso - 1), maximo: Math.max(0, b.maximo - 1) };
  const diagnostico: Valores["diagnostico"] & { secciones?: unknown } = { ...b.valores.diagnostico };
  delete diagnostico.secciones;
  return { ...pasos, v: 3, valores: { ...b.valores, diagnostico: { ...diagnostico, estados: diagnostico.estados ?? {}, detalles: diagnostico.detalles ?? {} } } };
}
const claveBorrador = (uid: string, id: string) => `mejoramiento:${uid}:${id}`;
/** One in-progress visit per inspector: this key points at its draft. */
const claveActual = (uid: string) => `mejoramiento:${uid}:actual`;
// idb-keyval opens IndexedDB synchronously: where it is blocked, it throws before returning a promise.
const idb = <T,>(fn: () => Promise<T>) => Promise.resolve().then(fn).catch(() => undefined);

const nuevo = (): Borrador => ({ v: 3, valores: visitaVacia(crypto.randomUUID()), fotos: {}, firma: null, paso: 0, maximo: 0, guardado_en: "" });

async function descartar(uid: string, b: Borrador) {
  await Promise.all([
    idb(() => del(claveBorrador(uid, b.valores.id))),
    idb(() => del(claveActual(uid))),
    quitarFotosVisita(b.valores.id, Object.values(b.fotos).flat().map((f) => f.ref)),
  ]);
}

/** Loads this inspector's draft and lets them continue it or start over. */
export function FormularioVisita({ uid }: { uid: string }) {
  const [estado, setEstado] = useState<{ b: Borrador; elegir: boolean } | null>(null);
  useEffect(() => {
    void idb(async () => {
      const id = await get<string>(claveActual(uid));
      return id ? get<Borrador>(claveBorrador(uid, id)) : undefined;
    }).then((b) => setEstado(b ? { b: migrar(b), elegir: true } : { b: nuevo(), elegir: false }));
  }, [uid]);

  if (!estado) return <p role="status">Cargando…</p>;
  if (estado.elegir) {
    const { b } = estado;
    return (
      <section className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-xl font-bold text-primary-strong">Tiene una visita sin enviar</h2>
        <p>
          {b.valores.propietario.nombre || b.valores.atiende.nombre || "Sin nombre"}
          {b.valores.propietario.direccion && `, ${b.valores.propietario.direccion}`}. Guardada en este equipo el {fechaHoraBogota(b.guardado_en)}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEstado({ b, elegir: false })}>Continuar borrador</Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (!window.confirm("Se borrarán los datos y las fotos de la visita sin enviar. ¿Continuar?")) return;
              void descartar(uid, b).then(() => setEstado({ b: nuevo(), elegir: false }));
            }}
          >
            Empezar de cero
          </Button>
        </div>
      </section>
    );
  }
  return <Formulario key={estado.b.valores.id} uid={uid} inicial={estado.b} onNueva={() => setEstado({ b: nuevo(), elegir: false })} />;
}

type Resultado = { codigo: string; en: string };

const suscribirConexion = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
const useEnLinea = () => useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true);

function Formulario({ uid, inicial, onNueva }: { uid: string; inicial: Borrador; onNueva: () => void }) {
  const [v, setV] = useState(inicial.valores);
  const [fotos, setFotos] = useState(inicial.fotos);
  const [firma, setFirma] = useState(inicial.firma);
  const [paso, setPaso] = useState(inicial.paso);
  const [maximo, setMaximo] = useState(inicial.maximo);
  const [mostrar, setMostrar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [progreso, setProgreso] = useState<ProgresoEnvio | "ubicacion" | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardadoEn, setGuardadoEn] = useState(inicial.guardado_en);
  const terminado = useRef(false);
  const enviandoRef = useRef(false);

  const enLinea = useEnLinea();
  const { mapa } = useApus();

  const aplica = v.diagnostico.aplica !== "no";
  const visibles = PASOS.map((_, i) => i).filter((i) => i !== 2 || aplica);

  // Warn before closing the tab only while a started draft has not been submitted.
  const pendiente = !!guardadoEn && !resultado;
  useEffect(() => {
    if (!pendiente) return;
    const avisar = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendiente]);

  // Autosave on this device (1 s debounce).
  useEffect(() => {
    const t = setTimeout(() => {
      if (terminado.current) return;
      const ahora = new Date().toISOString();
      const b: Borrador = { v: 3, valores: v, fotos, firma, paso, maximo, guardado_en: ahora };
      void idb(async () => {
        await guardar(claveBorrador(uid, v.id), b);
        await guardar(claveActual(uid), v.id);
        return true;
      }).then((ok) => ok && setGuardadoEn(ahora));
    }, 1000);
    return () => clearTimeout(t);
  }, [uid, v, fotos, firma, paso, maximo]);

  function validar(i: number): Record<string, string> {
    const e = erroresPaso(i, v);
    if (i === 2) {
      const f = erroresFotos(conteosFotos(v.capitulos, fotos));
      if (f.length) e.fotos = f.join(". ");
    }
    if (i === 3 && !firma) e.firma = "Falta la firma de quien atiende la visita";
    return e;
  }
  const errores = mostrar ? validar(paso) : {};
  const e = (k: string) => errores[k];

  function ir(i: number) {
    setPaso(i);
    setMaximo((m) => Math.max(m, i));
    setMostrar(false);
    setAviso("");
    window.scrollTo({ top: 0 });
  }
  function avanzar(destino: number) {
    for (const k of visibles.filter((k) => k >= paso && k < destino)) {
      if (Object.keys(validar(k)).length) {
        if (k !== paso) ir(k);
        setMostrar(true);
        setAviso("Revise los campos marcados antes de continuar.");
        requestAnimationFrame(() => document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus());
        return;
      }
    }
    ir(destino);
  }
  const siguienteVisible = visibles.find((i) => i > paso);
  const anteriorVisible = [...visibles].reverse().find((i) => i < paso);

  async function enviar() {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setAviso("");
    try {
      for (const k of visibles) {
        if (Object.keys(validar(k)).length) {
          ir(k);
          setMostrar(true);
          setAviso("Hay datos por completar en este paso.");
          return;
        }
      }
      setProgreso("ubicacion");
      const ubicacion = await obtenerUbicacion();
      const capitulos = aplica ? v.capitulos : [];
      // "No aplica": states typed before switching to No stay in the draft but are never sent.
      const diagnostico = aplica ? v.diagnostico : { ...v.diagnostico, estados: {}, detalles: {} };
      const png = dataUrlAPng(firma!);
      const archivos = construirManifiesto(capitulos, fotos, png.size);
      const blobs = new Map<string, Blob>([["firma", png]]);
      for (const a of archivos) {
        if (a.tipo !== "foto") continue;
        const blob = await cargarFotoVisita(v.id, a.ref);
        if (!blob) throw new Error("Una de las fotos ya no está en este equipo. Quítela y tómela de nuevo en el paso Cantidades.");
        blobs.set(a.ref, blob);
      }
      const r = await enviarVisita({ visita: aEntrada({ ...v, diagnostico, capitulos }), ubicacion, archivos }, blobs, setProgreso);
      if (!r.ok) throw new Error(r.error);
      terminado.current = true;
      await descartar(uid, { valores: v, fotos, firma, paso, maximo, guardado_en: "" });
      setResultado({ codigo: r.codigo, en: new Date().toISOString() });
    } catch (err) {
      setAviso(`${(err as Error).message} Sus datos siguen guardados en este equipo: puede intentar de nuevo.`);
    } finally {
      enviandoRef.current = false;
      setProgreso(null);
    }
  }

  if (resultado) return <Confirmacion r={resultado} onNueva={onNueva} />;

  const enviando = progreso !== null;
  const info = PASOS[paso];
  const hora = guardadoEn ? new Date(guardadoEn).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : "";
  const atiende = v.atiende;
  const prop = v.propietario;
  // When the owner attends, the owner's name and document ARE the attendee's: typed once, kept in sync.
  const setAtiende = (a: Partial<Valores["atiende"]>) => {
    const n = { ...atiende, ...a };
    const dejaDeSer = atiende.relacion === "propietario" && n.relacion !== "propietario";
    const propietario =
      n.relacion === "propietario"
        ? { ...prop, nombre: n.nombre, documento: n.documento, tipo_documento: n.tipo_documento ?? "cc" }
        : dejaDeSer
          ? { ...prop, nombre: "", documento: "", tipo_documento: undefined }
          : prop;
    setV({ ...v, atiende: n, propietario });
  };
  const esPropietario = atiende.relacion === "propietario";
  const setProp = (p: Partial<Valores["propietario"]>) => setV({ ...v, propietario: { ...prop, ...p } });

  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Pasos de la visita" className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <ol className="flex flex-wrap gap-1">
          {visibles.map((i, n) => (
            <li key={i}>
              <button
                type="button"
                disabled={i > maximo || enviando}
                aria-current={i === paso ? "step" : undefined}
                onClick={() => (i < paso ? ir(i) : avanzar(i))}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${i === paso ? "font-bold text-primary-strong" : "text-text"}`}
              >
                <span aria-hidden="true" className={`grid size-7 place-items-center rounded-full border-2 text-xs font-bold ${i === paso ? "border-primary bg-primary text-on-primary" : i < paso ? "border-primary text-primary" : "border-border text-muted"}`}>
                  {i < paso ? (
                    <IconoCheck className="size-3.5" />
                  ) : (
                    n + 1
                  )}
                </span>
                <span className={i === paso ? "" : "sr-only sm:not-sr-only"}>{PASOS[i].corto}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <header className="mb-6 border-l-4 border-accent pl-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-primary">Paso {visibles.indexOf(paso) + 1} de {visibles.length}</p>
          <p className={`text-sm ${enLinea ? "text-muted" : "font-semibold text-warning-text"}`}>
            {!enLinea ? "Sin conexión: se guarda en este equipo" : hora ? `Guardado en este equipo · ${hora}` : null}
          </p>
        </div>
        <h2 className="mt-1 text-2xl font-bold text-primary-strong">{info.titulo}</h2>
        <p className="mt-1 text-muted">{info.descripcion}</p>
      </header>

      <form noValidate onSubmit={(ev) => ev.preventDefault()} className="flex flex-col gap-5 pb-10">
        {paso === 0 && (
          <>
            <section aria-labelledby="titulo-atiende" className="flex flex-col gap-5">
              <h3 id="titulo-atiende" className="text-lg font-bold text-primary-strong">Quién atiende la visita</h3>
              <Segmentos
                legend="Relación con el predio"
                name="relacion"
                value={atiende.relacion}
                catalogo={RELACIONES_ATIENDE}
                error={e("atiende.relacion")}
                onChange={(relacion) => setAtiende({ relacion, parentesco: relacion === "arrendatario" && !atiende.parentesco ? RELACIONES_ATIENDE.arrendatario : atiende.parentesco })}
              />
              {atiende.relacion === "otro" && <CampoTexto label="¿Cuál?" value={atiende.relacion_otro} error={e("atiende.relacion_otro")} onChange={(relacion_otro) => setAtiende({ relacion_otro })} />}
              <CampoTexto label="Nombre completo" autoComplete="off" value={atiende.nombre} error={e("atiende.nombre")} onChange={(nombre) => setAtiende({ nombre })} />
              <CampoSelect label="Tipo de documento" catalogo={TIPOS_DOCUMENTO} value={atiende.tipo_documento ?? "cc"} error={e("atiende.tipo_documento")} onChange={(tipo_documento) => setAtiende({ tipo_documento })} />
              <CampoTexto label="Número de documento" inputMode="numeric" value={atiende.documento} error={e("atiende.documento")} onChange={(documento) => setAtiende({ documento })} />
              {atiende.relacion && atiende.relacion !== "propietario" && (
                <CampoTexto label="Parentesco con el propietario" value={atiende.parentesco} error={e("atiende.parentesco")} onChange={(parentesco) => setAtiende({ parentesco })} />
              )}
            </section>
            <section aria-labelledby="titulo-propietario" className="flex flex-col gap-5 border-t border-border pt-5">
              <h3 id="titulo-propietario" className="text-lg font-bold text-primary-strong">Propietario y predio</h3>
              {esPropietario ? (
                <div className="rounded-lg border border-border bg-bg p-3 text-sm">
                  <p>Quien atiende es el propietario: se usan su nombre y documento.</p>
                  <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                    <dt className="text-muted">Nombre</dt>
                    <dd>{atiende.nombre || "—"}</dd>
                    <dt className="text-muted">Tipo de documento</dt>
                    <dd>{TIPOS_DOCUMENTO[(atiende.tipo_documento ?? "cc") as keyof typeof TIPOS_DOCUMENTO]}</dd>
                    <dt className="text-muted">Número de documento</dt>
                    <dd>{atiende.documento || "—"}</dd>
                  </dl>
                </div>
              ) : (
                <>
                  <CampoTexto label="Nombre del propietario" value={prop.nombre} error={e("propietario.nombre")} onChange={(nombre) => setProp({ nombre })} />
                  <CampoSelect label="Tipo de documento del propietario" catalogo={TIPOS_DOCUMENTO} value={prop.tipo_documento} error={e("propietario.tipo_documento")} onChange={(tipo_documento) => setProp({ tipo_documento })} />
                  <CampoTexto label="Número de documento del propietario" inputMode="numeric" value={prop.documento} error={e("propietario.documento")} onChange={(documento) => setProp({ documento })} />
                </>
              )}
              <CampoTexto label="Teléfono de contacto" type="tel" inputMode="tel" value={prop.telefono} error={e("propietario.telefono")} onChange={(telefono) => setProp({ telefono })} />
              <CampoTexto label="Correo electrónico (opcional)" type="email" inputMode="email" value={prop.correo} error={e("propietario.correo")} onChange={(correo) => setProp({ correo })} />
              <CampoTexto label="Dirección del predio" value={prop.direccion} error={e("propietario.direccion")} onChange={(direccion) => setProp({ direccion })} />
              <div className="grid gap-5 sm:grid-cols-2">
                <CampoTexto label="Número de años habitando el predio" inputMode="numeric" value={prop.anios_habitando} error={e("propietario.anios_habitando")} onChange={(anios_habitando) => setProp({ anios_habitando })} />
                <CampoTexto label="Personas que habitan el predio" inputMode="numeric" value={prop.personas} error={e("propietario.personas")} onChange={(personas) => setProp({ personas })} />
              </div>
            </section>
          </>
        )}

        {paso === 1 && <PasoDiagnostico d={v.diagnostico} errores={errores} onChange={(diagnostico) => setV({ ...v, diagnostico })} />}

        {paso === 2 && <PasoCantidades visitaId={v.id} aplicaPara={v.diagnostico.aplica === "si" ? v.diagnostico.aplica_para : []} capitulos={v.capitulos} onChange={(capitulos) => setV({ ...v, capitulos })} fotos={fotos} onFotos={setFotos} errores={errores} />}

        {paso === 3 && (
          <>
            <Field label="Observaciones" error={e("observaciones")} hint={`${v.observaciones.length} de ${OBSERVACIONES_MAX} caracteres`}>
              {(a11y) => <TextArea {...a11y} rows={10} maxLength={OBSERVACIONES_MAX} value={v.observaciones} onChange={(ev) => setV({ ...v, observaciones: ev.target.value })} />}
            </Field>
            <Revision v={v} fotos={fotos} mapa={mapa} onEditar={(i) => ir(i)} />
            <section className="flex flex-col gap-2">
              <h3 className="text-lg font-bold text-primary-strong">Firma de quien atiende la visita</h3>
              <p>
                <span className="font-semibold">{atiende.nombre}</span>, C.C. {atiende.documento}
              </p>
              {firma ? (
                <div className="flex flex-col items-start gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                  <img src={firma} alt={`Firma de ${atiende.nombre ?? "quien atiende"}`} className="w-full max-w-xl rounded-lg border border-border bg-white" />
                  <Button variant="secondary" disabled={enviando} onClick={() => setFirma(null)}>Firmar de nuevo</Button>
                </div>
              ) : (
                <PadFirma
                  onConfirmar={(url) => {
                    if (url.startsWith("data:image/png")) setFirma(url);
                    else setAviso("La firma quedó muy pesada. Bórrela y firme con un trazo más simple.");
                  }}
                />
              )}
              {e("firma") && <p role="alert" className="text-sm font-medium text-danger">{e("firma")}</p>}
            </section>
            <p className="rounded-lg border border-border bg-surface p-3 text-sm">
              Al enviar se agregan automáticamente su firma registrada como inspector, la fecha, la hora y la ubicación del dispositivo. El sistema ubica la comuna o corregimiento y el barrio o vereda a partir de esa ubicación.
            </p>
          </>
        )}
      </form>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={anteriorVisible === undefined || enviando} onClick={() => anteriorVisible !== undefined && ir(anteriorVisible)}>
            Atrás
          </Button>
          {siguienteVisible !== undefined ? (
            <Button className="px-6" onClick={() => avanzar(siguienteVisible)}>{paso === 1 && !aplica ? "Ir al cierre" : "Siguiente"}</Button>
          ) : (
            <Button className="px-6" disabled={enviando} onClick={() => void enviar()}>
              {enviando ? "Enviando…" : aviso ? "Reintentar envío" : "Enviar visita"}
            </Button>
          )}
          {aplica && paso >= 2 && (
            <p className="ml-auto font-bold text-primary-strong md:order-last md:ml-0">
              Costo directo: <span className="tabular-nums">{formatoCop(presupuesto(v.capitulos, mapa).costo_directo_total)}</span>
            </p>
          )}
          <div role="status" className="basis-full text-sm md:flex-1 md:basis-auto md:text-right">
            {progreso ? <EstadoEnvio p={progreso} /> : aviso ? <span className="font-semibold text-danger">{aviso}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EstadoEnvio({ p }: { p: ProgresoEnvio | "ubicacion" }) {
  if (p === "ubicacion") return <span>Obteniendo la ubicación…</span>;
  const texto = { datos: "Registrando la visita…", archivos: `Subiendo archivos: ${p.subidos} de ${p.total}`, confirmar: "Confirmando…" }[p.etapa];
  return (
    <span className="flex items-center gap-2 md:justify-end">
      {texto}
      {p.etapa === "archivos" && <progress className="w-32" max={p.total || 1} value={p.subidos} />}
    </span>
  );
}

function obtenerUbicacion(): Promise<UbicacionGps> {
  return new Promise((ok, falla) => {
    if (!("geolocation" in navigator)) return falla(new Error("Este navegador no permite obtener la ubicación. Abra el formulario en Chrome o Safari actualizados."));
    navigator.geolocation.getCurrentPosition(
      (pos) => ok({ lat: pos.coords.latitude, lon: pos.coords.longitude, precision_m: Number.isFinite(pos.coords.accuracy) ? Math.min(pos.coords.accuracy, 100_000) : null }),
      (err) =>
        falla(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Se necesita la ubicación para enviar la visita. Toque el ícono junto a la dirección del navegador, permita «Ubicación» para este sitio, verifique que la ubicación del teléfono esté encendida y toque de nuevo «Enviar visita»."
              : "No se pudo obtener la ubicación. Encienda la ubicación (GPS) del teléfono, acérquese a una ventana o al exterior y toque de nuevo «Enviar visita».",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  });
}

function Bloque({ titulo, onEditar, children }: { titulo: string; onEditar: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold">{titulo}</h4>
        <Button variant="secondary" aria-label={`Editar ${titulo}`} onClick={onEditar}>Editar</Button>
      </div>
      <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-sm [overflow-wrap:anywhere]">{children}</dl>
    </div>
  );
}

/** "Revise antes de firmar": what the person signs, with a shortcut back to each step. */
function Revision({ v, fotos, mapa, onEditar }: { v: Valores; fotos: FotosPorFila; mapa: Map<string, Apu>; onEditar: (paso: number) => void }) {
  const d = v.diagnostico;
  const aplica = d.aplica === "si";
  const a = v.atiende;
  const relacion = a.relacion === "otro" ? a.relacion_otro : RELACIONES_ATIENDE[a.relacion as keyof typeof RELACIONES_ATIENDE];
  const p = presupuesto(v.capitulos, mapa);
  const totalFotos = conteosFotos(v.capitulos, fotos).reduce((s, n) => s + n, 0);
  return (
    <section aria-labelledby="titulo-revision" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h3 id="titulo-revision" className="text-lg font-bold text-primary-strong">Revise antes de firmar</h3>
      <Bloque titulo="Anfitrión" onEditar={() => onEditar(0)}>
        <dt className="text-muted">Atiende</dt>
        <dd className="font-semibold">{a.nombre}{relacion && ` (${relacion})`}</dd>
        <dt className="text-muted">Propietario</dt>
        <dd className="font-semibold">{v.propietario.nombre}</dd>
        <dt className="text-muted">Dirección</dt>
        <dd className="font-semibold">{v.propietario.direccion}</dd>
        <dt className="text-muted">Teléfono</dt>
        <dd className="font-semibold">{v.propietario.telefono}</dd>
      </Bloque>
      <Bloque titulo="Diagnóstico" onEditar={() => onEditar(1)}>
        <dt className="text-muted">Aplica</dt>
        <dd className="font-semibold">
          {aplica
            ? `Sí, para ${d.aplica_para.map((k) => APLICA_PARA[k as keyof typeof APLICA_PARA]).join(", ")}`
            : `No aplica: ${NO_APLICA_POR[d.no_aplica_por as keyof typeof NO_APLICA_POR] ?? ""}`}
        </dd>
        {aplica && (
          <>
            <dt className="text-muted">Alcance</dt>
            <dd className="font-semibold">{ALCANCES[d.alcance as keyof typeof ALCANCES] ?? ""}</dd>
          </>
        )}
      </Bloque>
      {aplica && (
        <Bloque titulo="Cantidades" onEditar={() => onEditar(2)}>
          {v.capitulos.map((c, i) => (
            <div key={c.id} className="contents">
              <dt className="text-muted">{c.nombre || `Capítulo ${i + 1}`}</dt>
              <dd className="font-semibold">{c.filas.length} actividades · {formatoCop(p.capitulos[i]?.subtotal ?? 0)}</dd>
            </div>
          ))}
          <dt className="text-muted">Costo directo</dt>
          <dd className="font-bold">{formatoCop(p.costo_directo_total)}</dd>
          <dt className="text-muted">Fotos</dt>
          <dd className="font-semibold">{totalFotos}</dd>
        </Bloque>
      )}
    </section>
  );
}

function Confirmacion({ r, onNueva }: { r: Resultado; onNueva: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <section aria-labelledby="conf-titulo" className="mx-auto flex max-w-lg flex-col gap-6 py-4">
      <div className="overflow-hidden rounded-xl border border-border bg-bg">
        <div className="relative bg-[#00365f] px-6 pb-6 pt-5 text-white">
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
          <h2 id="conf-titulo" ref={titulo} tabIndex={-1} className="text-xl font-bold outline-none">Visita registrada</h2>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div>
            <p className="text-sm text-muted">Código de visita</p>
            <p data-testid="codigo-visita" className="text-5xl font-bold tabular-nums tracking-tight text-primary-strong">{r.codigo}</p>
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Fecha y hora</dt>
            <dd className="font-semibold">{fechaHoraBogota(r.en)}</dd>
            <dt className="text-muted">Croquis</dt>
            <dd className="font-semibold text-warning-text">Sin croquis</dd>
          </dl>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/mejoramiento" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary">Ver mis visitas</Link>
        <Button variant="secondary" onClick={onNueva}>Nueva visita</Button>
      </div>
    </section>
  );
}
