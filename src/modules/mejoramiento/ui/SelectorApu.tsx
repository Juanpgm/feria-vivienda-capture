"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { controlClass } from "@/shared/ui/Field";
import type { Apu } from "../domain/apus";
import { buscarEnArbol, etiqueta, rutaApu, type Ambito, type CapituloApu } from "./arbolApus";
import { formatoCop, type OpcionApu } from "./armado";

// Last subchapter per budget chapter (Capitulo.id), kept while the page is open so the picker reopens there.
const ultimos = new Map<string, Ambito>();

const fila = "flex min-h-12 w-full items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-surface";

/**
 * "Agregar actividad": native modal (full screen below sm) drilling Capítulo > Subcapítulo > Ítems of the LISTADO DE
 * PRECIOS, with a search at every level. Chapters with a single subchapter skip that level.
 */
export function SelectorApu({ clave, arbol, opciones, disabled, onElegir }: {
  clave: string; arbol: CapituloApu[]; opciones: OpcionApu[]; disabled: boolean; onElegir: (a: Apu) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [ambito, setAmbito] = useState<Ambito | null>(null);
  const [q, setQ] = useState("");

  const cap = ambito && arbol.find((c) => c.codigo === ambito.capitulo);
  const sub = cap && ambito.subcapitulo ? cap.subcapitulos.find((s) => s.codigo === ambito.subcapitulo) : undefined;
  const saltaSub = cap?.subcapitulos.length === 1;

  function ir(a: Ambito | null) {
    const capitulo = a?.subcapitulo ? null : a?.capitulo;
    const unico = capitulo ? arbol.find((x) => x.codigo === capitulo)?.subcapitulos : undefined;
    if (capitulo && unico?.length === 1) a = { capitulo, subcapitulo: unico[0].codigo };
    setAmbito(a);
    setQ("");
    cuerpo.current?.scrollTo(0, 0);
  }
  const atras = () => ir(sub && !saltaSub ? { capitulo: cap!.codigo } : null);

  function abrir() {
    setAmbito(ultimos.get(clave) ?? null);
    setQ("");
    dialogo.current?.showModal();
    titulo.current?.focus(); // not the search field: a phone keyboard would hide the list
  }
  function elegir(a: Apu) {
    ultimos.set(clave, { capitulo: a.capitulo, subcapitulo: a.subcapitulo ?? a.capitulo });
    onElegir(a);
    dialogo.current?.close();
  }

  const buscando = q.trim().length >= 2;
  const resultados = buscando ? buscarEnArbol(opciones, q, ambito ?? undefined) : [];
  const lugar = sub ? etiqueta(sub.codigo, sub.nombre) : cap ? etiqueta(cap.codigo, cap.nombre) : "todo el listado";

  return (
    <>
      <Button ref={disparador} className="self-start" disabled={disabled} onClick={abrir}>
        Agregar actividad
      </Button>
      <dialog
        ref={dialogo}
        aria-labelledby={tituloId}
        onClose={() => disparador.current?.isConnected && disparador.current.focus()}
        className="m-0 h-dvh max-h-none w-full max-w-none flex-col bg-bg p-0 text-text backdrop:bg-black/50 open:flex sm:m-auto sm:h-[min(48rem,calc(100dvh-4rem))] sm:w-[min(44rem,calc(100%-2rem))] sm:rounded-xl sm:border sm:border-border"
      >
        <header className="flex flex-col gap-2 border-b border-border p-3">
          <div className="flex items-center gap-2">
            {ambito && <Button variant="secondary" className="min-h-12" onClick={atras}>Atrás</Button>}
            <h2 id={tituloId} ref={titulo} tabIndex={-1} className="min-w-0 flex-1 text-lg font-bold text-primary-strong outline-none">
              Elegir actividad
            </h2>
            <Button variant="secondary" className="min-h-12" onClick={() => dialogo.current?.close()}>Cerrar</Button>
          </div>
          <nav aria-label="Ruta en el listado de precios">
            <ol className="flex flex-wrap items-center gap-x-1 text-sm">
              <li>
                {ambito ? (
                  <button type="button" className="min-h-11 font-semibold text-primary underline underline-offset-2" onClick={() => ir(null)}>Capítulos</button>
                ) : (
                  <span aria-current="page" className="font-semibold">Capítulos</span>
                )}
              </li>
              {cap && (
                <li className="[overflow-wrap:anywhere]">
                  <span aria-hidden> › </span>
                  {sub && !saltaSub ? (
                    <button type="button" className="min-h-11 text-left text-primary underline underline-offset-2" onClick={() => ir({ capitulo: cap.codigo })}>{etiqueta(cap.codigo, cap.nombre)}</button>
                  ) : (
                    <span aria-current={sub ? undefined : "page"}>{etiqueta(cap.codigo, cap.nombre)}</span>
                  )}
                </li>
              )}
              {sub && !saltaSub && (
                <li className="[overflow-wrap:anywhere]"><span aria-hidden> › </span><span aria-current="page">{etiqueta(sub.codigo, sub.nombre)}</span></li>
              )}
            </ol>
          </nav>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Buscar en {lugar}</span>
            <input type="search" inputMode="search" enterKeyHint="search" className={controlClass} value={q} placeholder="ITEM o descripción" onChange={(e) => setQ(e.target.value)} />
          </label>
        </header>

        <div ref={cuerpo} className="min-h-0 flex-1 overflow-y-auto">
          {buscando ? (
            <Items apus={resultados} conRuta={!sub} onElegir={elegir} vacio="Sin resultados" />
          ) : sub ? (
            <Items apus={sub.items} onElegir={elegir} vacio="Este subcapítulo no tiene actividades" />
          ) : cap ? (
            <ul>
              {cap.subcapitulos.map((s) => (
                <li key={s.codigo}>
                  <button type="button" className={fila} onClick={() => ir({ capitulo: cap.codigo, subcapitulo: s.codigo })}>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><span className="font-semibold">{s.codigo}</span> {s.nombre}</span>
                    <Cuenta n={s.cantidad} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {arbol.map((c) => (
                <li key={c.codigo}>
                  <button type="button" className={fila} onClick={() => ir({ capitulo: c.codigo })}>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{c.nombre === c.codigo ? <span className="font-semibold">{c.codigo}</span> : <><span className="font-semibold">{c.codigo}</span> {c.nombre}</>}</span>
                    <Cuenta n={c.cantidad} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}

const Cuenta = ({ n }: { n: number }) => (
  <span className="shrink-0 text-sm text-muted">
    {n} {n === 1 ? "actividad" : "actividades"} <span aria-hidden>›</span>
  </span>
);

function Items({ apus, conRuta = false, onElegir, vacio }: { apus: Apu[]; conRuta?: boolean; onElegir: (a: Apu) => void; vacio: string }) {
  if (!apus.length) return <p className="p-4 text-muted">{vacio}</p>;
  return (
    <ul>
      {apus.map((a) => (
        <li key={a.item}>
          <button type="button" className={`${fila} flex-col items-stretch gap-1`} onClick={() => onElegir(a)}>
            <span className="[overflow-wrap:anywhere]"><span className="font-semibold">{a.item}</span> {a.descripcion}</span>
            <span className="flex flex-wrap justify-between gap-x-3 text-sm">
              <span className="text-muted">UND {a.und}</span>
              <span className="font-semibold">{formatoCop(a.costo_unitario)}</span>
            </span>
            {conRuta && <span className="text-xs text-muted [overflow-wrap:anywhere]">{rutaApu(a)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
