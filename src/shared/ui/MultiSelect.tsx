"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { filtrarOpciones, type OpcionBusqueda } from "../busqueda";
import { alternarSeleccion } from "../seleccionMultiple";
import { controlClass, Field } from "./Field";

type Props = {
  label: string;
  hint?: string;
  error?: string;
  options: OpcionBusqueda[];
  value: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  /** Option that excludes every other one (e.g. "ninguna"). */
  exclusiva?: string;
  /** From this many options the input accepts a search query (shorter lists are choose-only). */
  buscableDesde?: number;
  placeholder?: string;
};

/**
 * Multi-select dropdown with removable chips (ARIA 1.2 combobox + multiselectable listbox).
 * The list stays open while choosing; Arrow keys move, Enter (or Space on choose-only lists) toggles, Escape closes.
 */
export function MultiSelect({ label, hint, error, options, value, onChange, onBlur, exclusiva, buscableDesde = 8, placeholder = "Seleccione una o más" }: Props) {
  const listId = useId();
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);
  const buscable = options.length >= buscableDesde;
  const visibles = useMemo(() => filtrarOpciones(options, consulta, options.length), [options, consulta]);
  const indice = Math.min(activo, visibles.length - 1);
  const elegidas = options.filter((o) => value.includes(o.value));

  function alternar(o: OpcionBusqueda) {
    onChange(alternarSeleccion(value, o.value, !value.includes(o.value), exclusiva));
  }

  function mover(delta: number) {
    if (!visibles.length) return;
    const n = (indice + delta + visibles.length) % visibles.length;
    setActivo(n);
    listaRef.current?.children[n]?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) setAbierto(true);
      else mover(e.key === "ArrowDown" ? 1 : -1);
    } else if ((e.key === "Enter" || (e.key === " " && !buscable)) && abierto) {
      e.preventDefault();
      if (visibles[indice]) alternar(visibles[indice]);
    } else if (e.key === "Escape" && abierto) {
      e.preventDefault();
      setAbierto(false);
      setConsulta("");
    }
  }

  return (
    <Field label={label} hint={hint} error={error}>
      {(a11y) => (
        <div className="flex flex-col gap-2">
          {elegidas.length > 0 && (
            <ul aria-label={`${label}: seleccionadas`} className="flex flex-wrap gap-2">
              {elegidas.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    aria-label={`Quitar ${o.label}`}
                    onClick={() => alternar(o)}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-primary bg-surface px-3 text-left text-base text-text"
                  >
                    {o.label}
                    <span aria-hidden="true" className="text-lg leading-none text-muted">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="relative">
            <input
              {...a11y}
              className={`${controlClass} ${buscable ? "" : "cursor-pointer"}`}
              role="combobox"
              aria-expanded={abierto}
              aria-controls={listId}
              aria-autocomplete={buscable ? "list" : "none"}
              aria-activedescendant={abierto && visibles.length ? `${listId}-${indice}` : undefined}
              autoComplete="off"
              readOnly={!buscable}
              value={consulta}
              placeholder={placeholder}
              onClick={() => setAbierto(true)}
              onBlur={() => {
                setAbierto(false);
                setConsulta("");
                onBlur?.();
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
              aria-multiselectable="true"
              aria-label={label}
              hidden={!abierto}
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
            >
              {visibles.map((o, i) => {
                const marcada = value.includes(o.value);
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={marcada}
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep focus (and the list) on the input
                      alternar(o);
                    }}
                    onMouseEnter={() => setActivo(i)}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 text-base ${i === indice ? "bg-primary text-on-primary" : "text-text"} ${marcada ? "font-semibold" : ""}`}
                  >
                    <span aria-hidden="true" className="w-4 flex-none text-center">{marcada ? "✓" : ""}</span>
                    {o.label}
                  </li>
                );
              })}
              {abierto && visibles.length === 0 && (
                <li role="presentation" className="flex min-h-11 items-center px-3 text-sm text-muted">
                  Sin resultados
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </Field>
  );
}
