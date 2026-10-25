import type { InputHTMLAttributes } from "react";
import type { Option } from "./Select";

/**
 * Segmented control for 2-3 options. Native radios (arrow keys, form registration and a11y come for free)
 * stretched invisibly over each segment. Drop-in for RadioGroup: spread react-hook-form `register(name)` into `inputProps`.
 */
export function SegmentedControl({
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
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      <div
        className={`flex flex-col gap-1 rounded-lg border bg-surface p-1 sm:flex-row sm:self-start ${error ? "border-danger" : "border-border"}`}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 py-2 text-center text-base leading-snug text-text has-checked:bg-primary has-checked:font-semibold has-checked:text-on-primary sm:flex-1"
          >
            <input type="radio" name={name} value={o.value} className="absolute inset-0 size-full cursor-pointer opacity-0" {...inputProps} />
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
