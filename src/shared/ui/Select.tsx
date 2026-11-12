import type { SelectHTMLAttributes } from "react";
import { controlClass } from "./Field";

export type Option = { value: string; label: string; /** Short plain-language explanation shown under the label in list-style radio groups. */ description?: string };

export function Select({
  options,
  placeholder = "Seleccione...",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  return (
    <select className={controlClass} {...props}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
