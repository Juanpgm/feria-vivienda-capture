import { useId, type InputHTMLAttributes, type ReactElement, type TextareaHTMLAttributes } from "react";

export const controlClass =
  "min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-base text-text placeholder:text-muted aria-[invalid=true]:border-danger";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  /** Receives the id and aria props to spread on the control. */
  children: (a11y: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => ReactElement;
};

/** Label + control + hint/error wiring (aria-describedby). Use with render-prop children. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={controlClass} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} py-2`} {...props} />;
}
