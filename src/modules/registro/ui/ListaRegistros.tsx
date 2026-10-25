"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import divisiones from "@/modules/inmueble/catalogo/divisiones.json";
import { ESTADOS_REVISION, TIPOS_DOCUMENTO } from "@/shared/constantes";
import { fechaHoraBogota } from "@/shared/tiempo";
import { Button } from "@/shared/ui/Button";
import { Field, TextInput } from "@/shared/ui/Field";
import { Select, type Option } from "@/shared/ui/Select";

export type FilaListado = {
  id: string;
  radicado: string;
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  barrio: string;
  comuna: string;
  estrato: number;
  estado_revision: string;
  registrado_por_nombre: string;
  registrado_en: string | null;
};

type Campos = "q" | "nombre" | "comuna" | "barrio" | "estado_revision" | "registrado_por" | "desde" | "hasta";
type Filtros = Record<Campos, string>;
const VACIOS: Filtros = { q: "", nombre: "", comuna: "", barrio: "", estado_revision: "", registrado_por: "", desde: "", hasta: "" };
type Barrio = { id: string; nombre: string; codigo_division: string };
type Respuesta = { clave: string } & ({ items: FilaListado[]; siguiente: string | null } | { error: string });

const OPCIONES_COMUNA: Option[] = divisiones.map((d) => ({ value: d.codigo, label: d.tipo === "comuna" ? d.nombre : `Corregimiento ${d.nombre}` }));
const OPCIONES_ESTADO: Option[] = Object.entries(ESTADOS_REVISION).map(([value, label]) => ({ value, label }));
const linkBoton = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-semibold";
const documento = (f: FilaListado) => `${f.tipo_documento in TIPOS_DOCUMENTO ? TIPOS_DOCUMENTO[f.tipo_documento as keyof typeof TIPOS_DOCUMENTO] : f.tipo_documento} ${f.numero_documento}`;
const estado = (e: string) => ESTADOS_REVISION[e as keyof typeof ESTADOS_REVISION] ?? e;
const cuando = (f: FilaListado) => (f.registrado_en ? fechaHoraBogota(f.registrado_en) : "Sin fecha");

/** Search + filters + cursor pagination over GET /api/registros. `admin` unlocks the extra filters (the API scopes by role anyway). */
export function ListaRegistros({ admin, funcionarios }: { admin: boolean; funcionarios: { uid: string; nombre: string }[] }) {
  const [borrador, setBorrador] = useState<Filtros>(VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(VACIOS);
  const [cursores, setCursores] = useState<string[]>([""]); // cursor used to load each visited page
  const [intento, setIntento] = useState(0);
  const [resp, setResp] = useState<Respuesta | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const pagina = cursores.length - 1;
  const cursor = cursores[pagina];

  const params = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(aplicados)) if (v) p.set(k, v);
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, [aplicados, cursor]);
  const clave = `${params}#${intento}`;

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/registros?${params}`, { signal: ac.signal })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const campo = j?.campos ? Object.values(j.campos as Record<string, string[]>)[0]?.[0] : undefined;
          throw new Error(campo ?? j?.error ?? "No se pudo cargar la lista");
        }
        setResp({ clave, items: j.items, siguiente: j.siguiente });
      })
      .catch((e: Error) => {
        if (!ac.signal.aborted) setResp({ clave, error: e instanceof TypeError ? "No hay conexión con el servidor" : e.message });
      });
    return () => ac.abort();
  }, [params, clave]);

  useEffect(() => {
    if (admin) import("@/modules/inmueble/catalogo/barrios.json").then((m) => setBarrios(m.default));
  }, [admin]);

  const opcionesBarrio = useMemo(
    () => barrios.filter((b) => b.codigo_division === borrador.comuna).map((b) => ({ value: b.id, label: b.nombre })),
    [barrios, borrador.comuna],
  );
  const cargando = !resp || resp.clave !== clave;
  const filtrando = Object.values(aplicados).some(Boolean);
  const cambiar = (k: Campos) => (e: { target: { value: string } }) =>
    setBorrador((b) => ({ ...b, [k]: e.target.value, ...(k === "comuna" ? { barrio: "" } : {}) }));
  const aplicar = (f: Filtros) => {
    setAplicados(f);
    setCursores([""]);
    setIntento((n) => n + 1);
  };
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    aplicar(borrador);
  };
  const limpiar = () => {
    setBorrador(VACIOS);
    aplicar(VACIOS);
  };

  const items = resp && resp.clave === clave && "items" in resp ? resp.items : null;
  const siguiente = resp && resp.clave === clave && "items" in resp ? resp.siguiente : null;
  const error = resp && resp.clave === clave && "error" in resp ? resp.error : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-strong">Registros</h1>
        <Link href="/registros/nuevo" className={`${linkBoton} bg-primary text-on-primary hover:opacity-90`}>
          Nuevo registro
        </Link>
      </div>

      <form role="search" aria-label="Buscar registros" onSubmit={buscar} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Documento o radicado" hint="Por ejemplo 1234567 o FV-000123">
            {(a) => <TextInput {...a} type="search" autoComplete="off" value={borrador.q} onChange={cambiar("q")} />}
          </Field>
          <Field label="Nombre" hint="Escriba desde el primer nombre">
            {(a) => <TextInput {...a} type="search" autoComplete="off" value={borrador.nombre} onChange={cambiar("nombre")} />}
          </Field>
        </div>

        {admin && (
          <details className="rounded-lg border border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-primary-strong">Más filtros</summary>
            <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2">
              <Field label="Comuna o corregimiento">
                {(a) => <Select {...a} options={OPCIONES_COMUNA} placeholder="Todas" value={borrador.comuna} onChange={cambiar("comuna")} />}
              </Field>
              <Field label="Barrio o vereda">
                {(a) => (
                  <Select {...a} options={opcionesBarrio} placeholder="Todos" disabled={!borrador.comuna} value={borrador.barrio} onChange={cambiar("barrio")} />
                )}
              </Field>
              <Field label="Estado de revisión">
                {(a) => <Select {...a} options={OPCIONES_ESTADO} placeholder="Todos" value={borrador.estado_revision} onChange={cambiar("estado_revision")} />}
              </Field>
              <Field label="Registrado por">
                {(a) => (
                  <Select
                    {...a}
                    options={funcionarios.map((f) => ({ value: f.uid, label: f.nombre }))}
                    placeholder="Todos"
                    value={borrador.registrado_por}
                    onChange={cambiar("registrado_por")}
                  />
                )}
              </Field>
              <Field label="Registrado desde">
                {(a) => <TextInput {...a} type="date" value={borrador.desde} onChange={cambiar("desde")} />}
              </Field>
              <Field label="Registrado hasta">
                {(a) => <TextInput {...a} type="date" value={borrador.hasta} onChange={cambiar("hasta")} />}
              </Field>
            </div>
          </details>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Buscar</Button>
          {(filtrando || Object.values(borrador).some(Boolean)) && (
            <Button variant="secondary" onClick={limpiar}>
              Limpiar
            </Button>
          )}
        </div>
      </form>

      <section aria-label="Resultados" className="flex flex-col gap-4">
        <div aria-live="polite" className="text-sm text-muted">
          {cargando ? "Cargando registros…" : items ? `${items.length} ${items.length === 1 ? "registro" : "registros"} en esta página` : ""}
        </div>

        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-danger">
            <p className="font-medium">{error}</p>
            <Button variant="secondary" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </Button>
          </div>
        )}

        {items && items.length === 0 && (
          <div className="rounded-lg border border-border bg-surface p-4">
            {filtrando ? (
              <>
                <p className="font-semibold">No se encontraron registros con esos criterios.</p>
                <p className="mt-1 text-muted">Revise el documento o el radicado, o quite algún filtro.</p>
                <Button variant="secondary" className="mt-3" onClick={limpiar}>
                  Quitar filtros
                </Button>
              </>
            ) : (
              <>
                <p className="font-semibold">Aún no hay registros.</p>
                <p className="mt-1 text-muted">
                  {admin ? "Cuando los funcionarios envíen registros aparecerán aquí." : "Los registros que usted envíe aparecerán aquí."}
                </p>
              </>
            )}
          </div>
        )}

        {items && items.length > 0 && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Registros, del más reciente al más antiguo</caption>
                <thead>
                  <tr className="border-b border-border text-muted">
                    {["Radicado", "Nombre", "Documento", "Barrio y comuna", "Estrato", "Revisión", "Registrado"].map((h) => (
                      <th key={h} scope="col" className="px-2 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((f) => (
                    <tr key={f.id} className="border-b border-border align-top">
                      <td className="px-2 py-1 whitespace-nowrap">
                        <Link href={`/registros/${f.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
                          {f.radicado}
                        </Link>
                      </td>
                      <td className="px-2 py-3">{f.nombre}</td>
                      <td className="px-2 py-3 whitespace-nowrap">{documento(f)}</td>
                      <td className="px-2 py-3">
                        {f.barrio}, {f.comuna}
                      </td>
                      <td className="px-2 py-3">{f.estrato}</td>
                      <td className="px-2 py-3">{estado(f.estado_revision)}</td>
                      <td className="px-2 py-3">
                        <span className="whitespace-nowrap">{cuando(f)}</span>
                        <br />
                        <span className="text-muted">{f.registrado_por_nombre}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border border-y border-border md:hidden">
              {items.map((f) => (
                <li key={f.id} className="py-2">
                  <Link href={`/registros/${f.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
                    {f.radicado}
                  </Link>
                  <p className="font-medium">{f.nombre}</p>
                  <p className="text-sm">{documento(f)}</p>
                  <p className="text-sm text-muted">
                    {f.barrio}, {f.comuna}. Estrato {f.estrato}
                  </p>
                  <p className="text-sm text-muted">
                    {estado(f.estado_revision)}. {cuando(f)}, {f.registrado_por_nombre}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        {(pagina > 0 || siguiente) && (
          <nav aria-label="Paginación" className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={pagina === 0 || cargando} onClick={() => setCursores((c) => c.slice(0, -1))}>
              Anterior
            </Button>
            <span className="text-sm text-muted">Página {pagina + 1}</span>
            <Button variant="secondary" disabled={!siguiente || cargando} onClick={() => setCursores((c) => [...c, siguiente!])}>
              Siguiente
            </Button>
          </nav>
        )}
      </section>
    </div>
  );
}
