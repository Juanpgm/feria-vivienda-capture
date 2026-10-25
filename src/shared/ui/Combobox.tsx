import { useId, type InputHTMLAttributes } from "react";
import { controlClass } from "./Field";
import type { Option } from "./Select";

/**
 * Searchable select built on native <input list>/<datalist> (typing filters the options).
 * ponytail: the browser decides matching (not accent-insensitive everywhere); task 2.8 replaces
 * this with an accent/case-insensitive custom listbox once the catalogs exist.
 */
export function Combobox({
  options,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "list"> & { options: Option[] }) {
  const listId = useId();
  return (
    <>
      <input className={controlClass} list={listId} autoComplete="off" {...props} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.value} value={o.label} />
        ))}
      </datalist>
    </>
  );
}
