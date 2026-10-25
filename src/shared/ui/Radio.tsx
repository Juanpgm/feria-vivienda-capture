import type { InputHTMLAttributes } from "react";
import type { Option } from "./Select";

/** Accessible radio group (fieldset/legend); spread react-hook-form `register(name)` into `inputProps`. */
export function RadioGroup({
  legend,
  name,
  options,
  error,
  inputProps,
}: {
  legend: string;
  name: string;
  options: Option[];
  error?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}) {
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 has-checked:border-primary has-checked:bg-surface"
          >
            <input type="radio" name={name} value={o.value} className="radio" {...inputProps} />
            {o.label}
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
