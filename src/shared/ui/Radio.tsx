import type { InputHTMLAttributes } from "react";
import { useAyuda } from "./Ayuda";
import type { Option } from "./Select";

/** Accessible radio group (fieldset/legend); spread react-hook-form `register(name)` into `inputProps`. */
export function RadioGroup({
  legend,
  name,
  options,
  error,
  inputProps,
  lista = false,
}: {
  legend: string;
  name: string;
  options: Option[];
  error?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  /** One option per line as a large card (long labels, 4+ options). */
  lista?: boolean;
}) {
  const errorId = `${name}-error`;
  const ayuda = useAyuda(legend);
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">{legend}</legend>
      {ayuda.boton && <div className="flex items-center">{ayuda.boton}<span className="text-sm text-muted">¿Qué significa?</span></div>}
      {ayuda.panel}
      <div className={lista ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer gap-3 rounded-lg border border-border px-3 has-checked:border-2 has-checked:border-primary has-checked:bg-surface ${lista ? "min-h-14 items-start py-3" : "min-h-11 items-center"}`}
          >
            <input type="radio" name={name} value={o.value} className={`radio ${lista ? "mt-0.5" : ""}`} {...inputProps} />
            <span className="flex flex-col">
              <span className="font-medium">{o.label}</span>
              {lista && o.description && <span className="text-sm text-muted">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
