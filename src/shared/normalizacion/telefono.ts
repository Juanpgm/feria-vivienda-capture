import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/** E.164 string (default country CO) or null when empty/invalid. Numbers with another valid prefix are kept. */
export function normalizarTelefono(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const p = parsePhoneNumberFromString(t, "CO");
  return p?.isValid() ? p.number : null;
}
