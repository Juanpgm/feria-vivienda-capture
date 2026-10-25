"use client";

import { useId, useMemo, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { filtrarOpciones, type OpcionBusqueda } from "../busqueda";
import { controlClass } from "./Field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "role" | "list" | "defaultValue"> & {
  options: OpcionBusqueda[];
  /** Selected option value ("" = none). */
  value: string;
  onChange: (value: string) => void;
  /** Width classes of the list; wider than the control for narrow selectors. */
  listaClass?: string;
  /** Max options listed (default 50; raise it for catalogs that should be scrollable in full). */
  limite?: number;
};

/**
 * Searchable single-select following the ARIA 1.2 combobox pattern (editable, list autocomplete).
 * Typing filters accent/case-insensitively; Arrow keys move, Enter selects, Escape closes/clears the query.
 */
export function Combobox({ options, value, onChange, onBlur, onFocus, listaClass = "w-full", limite = 50, ...props }: Props) {
  const listId = useId();
  const seleccion = options.find((o) => o.value === value);
  const [consulta, setConsulta] = useState<string | null>(null); // null = show the selected label
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  const texto = consulta ?? seleccion?.corta ?? seleccion?.label ?? "";
  const visibles = useMemo(() => filtrarOpciones(options, consulta ?? "", limite), [options, consulta, limite]);
  const indiceActivo = Math.min(activo, visibles.length - 1);

  function elegir(o: OpcionBusqueda) {
    onChange(o.value);
    setConsulta(null);
    setAbierto(false);
  }

  function mover(delta: number) {
    if (!visibles.length) return;
    const n = (indiceActivo + delta + visibles.length) % visibles.length;
    setActivo(n);
    listaRef.current?.children[n]?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) setAbierto(true);
      else mover(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault();
      if (visibles[indiceActivo]) elegir(visibles[indiceActivo]);
    } else if (e.key === "Escape" && abierto) {
      e.preventDefault();
      setAbierto(false);
      setConsulta(null);
    }
  }

  return (
    <div className="relative">
      <input
        {...props}
        className={controlClass}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={abierto && visibles.length ? `${listId}-${indiceActivo}` : undefined}
        autoComplete="off"
        value={texto}
        // Not opened on focus: tabbing through the form would leave the list covering the fields below.
        onFocus={onFocus}
        onClick={() => setAbierto(true)}
        onBlur={(e) => {
          // Options use onMouseDown+preventDefault, so blur only fires when focus really leaves.
          setAbierto(false);
          if (consulta !== null) {
            if (consulta === "") onChange("");
            setConsulta(null); // free text that was not selected is discarded
          }
          onBlur?.(e);
        }}
        onChange={(e) => {
          setConsulta(e.target.value);
          setActivo(0);
          setAbierto(true);
        }}
        onKeyDown={onKeyDown}
      />
      <ul
        id={listId}
        ref={listaRef}
        role="listbox"
        hidden={!abierto}
        className={`absolute z-20 mt-1 max-h-64 ${listaClass} overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg`}
      >
        {visibles.map((o, i) => (
          <li
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.value === value}
            onMouseDown={(e) => {
              e.preventDefault();
              elegir(o);
            }}
            onMouseEnter={() => setActivo(i)}
            className={`flex min-h-11 cursor-pointer items-center px-3 text-base text-text ${
              i === indiceActivo ? "bg-primary text-on-primary" : ""
            } ${o.value === value ? "font-semibold" : ""}`}
          >
            {o.label}
          </li>
        ))}
        {abierto && visibles.length === 0 && (
          <li role="presentation" className="flex min-h-11 items-center px-3 text-sm text-muted">
            Sin resultados
          </li>
        )}
      </ul>
    </div>
  );
}
