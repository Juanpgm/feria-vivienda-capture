"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ESTADOS_REVISION } from "@/shared/constantes";
import { fechaBogota, fechaHoraBogota } from "@/shared/tiempo";
import { Button } from "@/shared/ui/Button";
import { filasDe, SECCIONES } from "./datosResumen";
import { ListaFilas } from "./ListaFilas";

type Detalle = {
  id: string;
  radicado: string;
  estado_revision: string;
  registrado_por_nombre: string;
  registrado_por_correo: string;
  registrado_en: string | null;
  datos: Record<string, unknown>;
  historial: { tipo: string; estado_revision: string; por_nombre: string; por_correo: string; en: string | null }[];
};
type Estado = { id: string; intento: number } & ({ ok: Detalle } | { error: string; noExiste?: boolean });

const TIPOS_HISTORIAL: Record<string, string> = { creacion: "Registro creado" };
const estado = (e: string) => ESTADOS_REVISION[e as keyof typeof ESTADOS_REVISION] ?? e;
const volver = (
  <Link href="/registros" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
    Volver a registros
  </Link>
);

/** Read-only view of one registro: radicado, who/when, review status, every captured section and the historial. */
export function DetalleRegistro({ id }: { id: string }) {
  const [intento, setIntento] = useState(0);
  const [r, setR] = useState<Estado | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/registros/${encodeURIComponent(id)}`, { signal: ac.signal })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (res.ok) return setR({ id, intento, ok: j });
        setR({ id, intento, error: j?.error ?? "No se pudo cargar el registro", noExiste: res.status === 404 });
      })
      .catch((e: Error) => {
        if (!ac.signal.aborted) setR({ id, intento, error: e instanceof TypeError ? "No hay conexión con el servidor" : e.message });
      });
    return () => ac.abort();
  }, [id, intento]);

  if (!r || r.id !== id || r.intento !== intento) return <p role="status">Cargando registro…</p>;
  if ("error" in r) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-bold text-primary-strong">{r.noExiste ? "Registro no encontrado" : "No se pudo cargar el registro"}</h1>
        <p role="alert" className="text-danger">
          {r.noExiste ? "El registro no existe o usted no tiene acceso a él." : r.error}
        </p>
        {!r.noExiste && <Button variant="secondary" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>}
        {volver}
      </div>
    );
  }

  const d = r.ok;
  const hoy = fechaBogota();
  return (
    <div className="flex max-w-[56rem] flex-col gap-8">
      <div>
        {volver}
        <h1 className="text-2xl font-bold text-primary-strong">Registro {d.radicado}</h1>
      </div>

      <section aria-labelledby="det-control">
        <h2 id="det-control" className="mb-2 border-b border-border pb-1 text-lg font-bold text-primary-strong">
          Control
        </h2>
        <ListaFilas
          filas={[
            { etiqueta: "Radicado", valor: d.radicado },
            { etiqueta: "Estado de revisión", valor: estado(d.estado_revision) },
            { etiqueta: "Registrado por", valor: `${d.registrado_por_nombre} (${d.registrado_por_correo})` },
            { etiqueta: "Fecha de registro", valor: d.registrado_en ? fechaHoraBogota(d.registrado_en) : "Sin fecha" },
          ]}
        />
      </section>

      {SECCIONES.map((s) => (
        <section key={s.id} aria-labelledby={`det-${s.id}`}>
          <h2 id={`det-${s.id}`} className="mb-2 border-b border-border pb-1 text-lg font-bold text-primary-strong">
            {s.titulo}
          </h2>
          <ListaFilas filas={filasDe(s.id, d.datos[s.id], hoy)} />
        </section>
      ))}

      <section aria-labelledby="det-historial">
        <h2 id="det-historial" className="mb-2 border-b border-border pb-1 text-lg font-bold text-primary-strong">
          Historial
        </h2>
        {d.historial.length === 0 ? (
          <p className="text-muted">Sin movimientos.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {d.historial.map((h, i) => (
              <li key={i}>
                <span className="font-semibold">{TIPOS_HISTORIAL[h.tipo] ?? h.tipo}</span>
                {` · ${estado(h.estado_revision)} · ${h.por_nombre} · ${h.en ? fechaHoraBogota(h.en) : "Sin fecha"}`}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
