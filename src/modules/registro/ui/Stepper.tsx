"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { FormProvider, set, useForm, type FieldErrors, type FieldValues, type Resolver } from "react-hook-form";
import { PasoComposicion } from "@/modules/composicion/ui/PasoComposicion";
import { PasoProteccion } from "@/modules/composicion/ui/PasoProteccion";
import { PasoCierreFinanciero } from "@/modules/cierre-financiero/ui/PasoCierreFinanciero";
import { PasoConsentimiento } from "@/modules/consentimiento/ui/PasoConsentimiento";
import { PasoDocumentos } from "@/modules/documentos/ui/PasoDocumentos";
import { PasoHogar } from "@/modules/hogar/ui/PasoHogar";
import { PasoInmueble } from "@/modules/inmueble/ui/PasoInmueble";
import { PasoRiesgo } from "@/modules/riesgo/ui/PasoRiesgo";
import { PasoTitularidad } from "@/modules/titularidad/ui/PasoTitularidad";
import { FIRMA_VACIA } from "@/modules/firma/domain/schema";
import { Button } from "@/shared/ui/Button";
import { Confirmacion, type DatosConfirmacion } from "./Confirmacion";
import { EnvioRegistro } from "./EnvioRegistro";
import { Resumen } from "./Resumen";
import { cargarBorrador, descartarBorrador, guardarBorrador, VERSION_BORRADOR, type Borrador } from "./borradores";
import { ETIQUETA_ESTADO, estadoPaso, PASOS, validarPaso, type Marca, type Valores } from "./pasos";

type PropsVista = {
  irAPaso: (id: string) => void;
  borradorId: string;
  /** Last step only: submit finished (the owner deletes the draft and shows the confirmation) / submit running. */
  alEnviado?: (d: DatosConfirmacion) => void;
  alBloquear?: (ocupado: boolean) => void;
};
const VISTAS: Record<string, ComponentType<PropsVista>> = {
  hogar: PasoHogar,
  composicion: PasoComposicion,
  proteccion: PasoProteccion,
  inmueble: PasoInmueble,
  riesgo: PasoRiesgo,
  titularidad: PasoTitularidad,
  financiero: PasoCierreFinanciero,
  consentimiento: PasoConsentimiento,
  documentos: PasoDocumentos,
  resumen: Resumen,
  firma: EnvioRegistro,
};

export const nuevoBorrador = (id: string): Borrador => ({
  id,
  version: VERSION_BORRADOR,
  paso: PASOS[0].id,
  maximo: 0,
  marcas: {},
  guardado_en: "",
  valores: {
    solicitante: {
      primer_nombre: "", segundo_nombre: "", primer_apellido: "", segundo_apellido: "",
      tipo_documento: "", tipo_documento_otro: "", codigo_pais_nacionalidad: "", numero_documento: "",
      fecha_expedicion_documento: "", telefono_1: "", telefono_1_pais: "CO", telefono_2: "", telefono_2_pais: "CO", correo_solicitante: "", anios_residencia: "",
      fecha_nacimiento: "", estado_civil: "",
    },
    composicion: {
      cantidad_personas_hogar: "", tiene_adulto_mayor: "", cantidad_adultos_mayores: "", adultos_mayores: [],
      condiciones_especiales: [], ingreso_hogar_cop: "",
    },
    inmueble: {
      direccion: "", codigo_division: "", id_barrio_vereda: "", estrato: "",
    },
    riesgo: { esta_en_rud: "", numero_rud: "", rud_no_sabe: false, dictamen: "", dictamen_otro: "" },
    titularidad: { tipo_titularidad: "", numero_matricula_inmobiliaria: "", es_unica_propiedad: "", excepcion_unica_propiedad: "" },
    cierre_financiero: { fuentes_financiacion: [], tiene_seguro: "", codigo_aseguradora: "", aseguradora_otra: "", observaciones: "" },
    // Markers only; the photos live in IndexedDB (modules/documentos/ui/fotos.ts).
    documentos: { documento_frente: "", documento_reverso: "" },
    consentimiento: { acepta_tratamiento: false, acepta_datos_sensibles: false, version: "" },
    firma: { ...FIRMA_VACIA },
  },
});

/** Loads the draft `borradorId` from IndexedDB (a blank one when it does not exist yet), then mounts the form. */
export function Stepper({ uid, borradorId }: { uid: string; borradorId: string }) {
  const [estado, setEstado] = useState<{ borrador: Borrador; recuperado: boolean } | null>(null);
  useEffect(() => {
    cargarBorrador(uid, borradorId)
      .catch(() => null)
      // Sections added after the draft was saved (consent, signature...) start from their defaults.
      .then((b) => setEstado({ borrador: b ? { ...b, valores: { ...nuevoBorrador(borradorId).valores, ...b.valores } } : nuevoBorrador(borradorId), recuperado: !!b }));
  }, [uid, borradorId]);

  if (!estado) return <p role="status">Cargando borrador…</p>;
  return <Formulario key={borradorId} uid={uid} inicial={estado.borrador} recuperado={estado.recuperado} />;
}

type Guardado = "ninguno" | "guardando" | "guardado" | "error";

function Formulario({ uid, inicial, recuperado }: { uid: string; inicial: Borrador; recuperado: boolean }) {
  const router = useRouter();
  const [pasoId, setPasoId] = useState(inicial.paso);
  const [maximo, setMaximo] = useState(inicial.maximo);
  const [marcas, setMarcas] = useState<Record<string, Marca>>(inicial.marcas);
  const [guardado, setGuardado] = useState<Guardado>(inicial.guardado_en ? "guardado" : "ninguno");
  const [horaGuardado, setHoraGuardado] = useState(inicial.guardado_en);
  const [aviso, setAviso] = useState("");
  const [fallos, setFallos] = useState(0);
  const indice = Math.max(0, PASOS.findIndex((p) => p.id === pasoId));
  const paso = PASOS[indice];
  const Vista = VISTAS[paso.id];
  const formRef = useRef<HTMLFormElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [cambios, setCambios] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const pendiente = useRef(false); // a change not yet written
  const guardarRef = useRef<() => Promise<void>>(async () => {});
  const [ocupado, setOcupado] = useState(false); // a submit is running: no navigation, no discarding
  const terminado = useRef(false); // submitted: the draft is gone and must not be written again
  const [confirmacion, setConfirmacion] = useState<DatosConfirmacion | null>(null);

  // The resolver validates only the current step; RHF shows each field's error after blur / Next.
  const resolver: Resolver<FieldValues> = async (valores) => {
    const planos = await validarPaso(paso, valores as Valores);
    const errors: FieldErrors = {};
    for (const [ruta, message] of Object.entries(planos)) set(errors, ruta, { type: "validation", message });
    return Object.keys(planos).length ? { values: {}, errors } : { values: valores, errors: {} };
  };
  const form = useForm<FieldValues>({ defaultValues: inicial.valores, resolver, mode: "onTouched" });
  const { subscribe, getValues, trigger } = form;

  const marcarCambio = useCallback(() => {
    setGuardado("guardando");
    setCambios((c) => c + 1);
  }, []);
  useEffect(() => subscribe({ formState: { values: true }, callback: marcarCambio }), [subscribe, marcarCambio]);

  // Writes the CURRENT state of this draft only (never another draft).
  useEffect(() => {
    guardarRef.current = async () => {
      if (terminado.current) return;
      const ahora = new Date().toISOString();
      pendiente.current = false;
      try {
        await guardarBorrador(uid, { id: inicial.id, valores: getValues() as Valores, paso: pasoId, maximo, marcas, guardado_en: ahora });
        setGuardado("guardado");
        setHoraGuardado(ahora);
      } catch {
        setGuardado("error");
      }
    };
  });

  // Debounced autosave (1 s). Nothing is written until the user changes something.
  useEffect(() => {
    if (!cambios) return;
    pendiente.current = true;
    const t = setTimeout(() => void guardarRef.current(), 1000);
    temporizador.current = t;
    return () => clearTimeout(t);
  }, [cambios, pasoId, maximo, marcas]);

  // Leaving the form (list link, back button) must not lose the last second of typing.
  useEffect(() => () => {
    if (pendiente.current) void guardarRef.current();
  }, []);

  // After a failed "Siguiente", move focus to the first invalid control once errors are rendered.
  useEffect(() => {
    if (fallos) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], fieldset[aria-describedby] input')?.focus();
  }, [fallos]);

  function irA(i: number, nuevasMarcas = marcas) {
    setPasoId(PASOS[i].id);
    setMaximo(Math.max(maximo, i));
    setMarcas(nuevasMarcas);
    setAviso("");
    marcarCambio();
    window.scrollTo({ top: 0 });
  }

  async function siguiente() {
    const ok = await trigger();
    const nuevas: Record<string, Marca> = { ...marcas, [paso.id]: ok ? "completo" : "errores" };
    if (!ok) {
      setMarcas(nuevas);
      marcarCambio();
      setFallos((f) => f + 1);
      setAviso("Revise los campos marcados antes de continuar.");
    } else irA(indice + 1, nuevas);
  }

  const irAPaso = (id: string) => irA(PASOS.findIndex((p) => p.id === id));

  // Sent and confirmed by the server: drop the draft (and its photos) for good, leave the URL of the used draft.
  async function alEnviado(d: DatosConfirmacion) {
    terminado.current = true;
    clearTimeout(temporizador.current);
    pendiente.current = false;
    await descartarBorrador(uid, inicial.id).catch(() => undefined);
    window.history.replaceState(null, "", "/registros/nuevo");
    setConfirmacion(d);
  }

  async function descartar() {
    clearTimeout(temporizador.current);
    pendiente.current = false; // do not resurrect the draft on unmount
    await descartarBorrador(uid, inicial.id).catch(() => undefined);
    router.push("/registros/nuevo");
  }

  const estadoGuardado =
    guardado === "guardando" ? "Guardando borrador…"
    : guardado === "error" ? "No se pudo guardar el borrador en este equipo"
    : guardado === "guardado" ? `Borrador guardado ${new Date(horaGuardado).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`
    : "Sin cambios por guardar";

  if (confirmacion) return <Confirmacion datos={confirmacion} />;

  return (
    <FormProvider {...form}>
      <div className="md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
        <nav aria-label="Pasos del registro" className="hidden md:block">
          <ol className="flex flex-col">
            {PASOS.map((p, i) => {
              const e = estadoPaso(p.id, paso.id, marcas);
              return (
                <li key={p.id} className="relative pb-5 pl-11 last:pb-0">
                  <button
                    type="button"
                    disabled={i > maximo || ocupado}
                    aria-current={e === "en_curso" ? "step" : undefined}
                    onClick={() => irA(i)}
                    className="flex min-h-11 w-full flex-col items-start rounded-lg text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-0 grid size-8 place-items-center rounded-full border-2 text-sm font-bold ${
                        e === "en_curso" ? "border-primary bg-primary text-on-primary ring-2 ring-accent ring-offset-2 ring-offset-bg"
                        : e === "completo" ? "border-success text-success"
                        : e === "con_errores" ? "border-danger text-danger"
                        : "border-border text-muted"
                      }`}
                    >
                      {e === "completo" ? "✓" : i + 1}
                    </span>
                    <span className={`text-sm ${e === "en_curso" ? "font-bold" : "font-semibold"}`}>{p.titulo}</span>
                    <span className={`text-sm ${e === "con_errores" ? "text-danger" : "text-muted"}`}>{ETIQUETA_ESTADO[e]}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="max-w-[44rem]">
          <div className="mb-6">
            <Link href="/registros/nuevo" className="mb-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-2">
              Ver borradores en curso
            </Link>
            <p className="text-sm text-muted md:hidden">
              Paso {indice + 1} de {PASOS.length}
            </p>
            <h2 className="text-2xl font-bold text-primary-strong">{paso.titulo}</h2>
            {recuperado && indice === 0 && inicial.guardado_en && (
              <p className="mt-1 text-sm text-muted">Se recuperó el borrador guardado en este equipo.</p>
            )}
          </div>
          <form ref={formRef} noValidate onSubmit={(e) => e.preventDefault()} className="pb-6">
            <Vista irAPaso={irAPaso} borradorId={inicial.id} alEnviado={alEnviado} alBloquear={setOcupado} />
          </form>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg px-4 py-3 md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="secondary" disabled={indice === 0 || ocupado} onClick={() => irA(indice - 1)}>
            Atrás
          </Button>
          {indice < PASOS.length - 1 && <Button onClick={siguiente}>Siguiente</Button>}
          <p role="status" className="order-last basis-full text-sm text-muted md:order-none md:basis-auto md:flex-1 md:text-right">
            {aviso && <span className="mr-2 font-medium text-text">{aviso}</span>}
            <span className={guardado === "error" ? "font-medium text-danger" : ""}>{estadoGuardado}</span>
          </p>
          {confirmando ? (
            <div role="group" aria-label="Confirmar descarte" className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">¿Descartar este borrador? Se borrarán los datos ingresados.</span>
              <Button variant="danger" onClick={descartar}>
                Sí, descartar
              </Button>
              <Button variant="secondary" onClick={() => setConfirmando(false)}>
                Conservar
              </Button>
            </div>
          ) : (
            <Button variant="secondary" disabled={ocupado} onClick={() => setConfirmando(true)}>
              Descartar borrador
            </Button>
          )}
        </div>
      </div>
    </FormProvider>
  );
}
