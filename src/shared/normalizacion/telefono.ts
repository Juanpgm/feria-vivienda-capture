import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

export const REGION_POR_DEFECTO: CountryCode = "CO";
const REGIONES = new Set<string>(getCountries());

/** E.164 string (default country CO) or null when empty/invalid. Numbers with another valid prefix are kept. */
export function normalizarTelefono(raw: string, region: CountryCode = REGION_POR_DEFECTO): string | null {
  const t = raw.trim();
  if (!t) return null;
  const p = parsePhoneNumberFromString(t, region);
  return p?.isValid() ? p.number : null;
}

export const esRegion = (iso: string): iso is CountryCode => REGIONES.has(iso);
export const codigoMarcacion = (region: CountryCode) => getCountryCallingCode(region);

/** Main country of calling codes shared by several regions (the metadata order is alphabetical, so AG would win +1). */
const PRINCIPAL: Record<string, CountryCode> = {
  "1": "US", "7": "RU", "39": "IT", "44": "GB", "47": "NO", "61": "AU", "212": "MA", "262": "RE", "358": "FI", "590": "GP", "599": "CW",
};

/** Region of a calling code, preferring `preferida` when it shares that code (+1, +7...). */
export function regionDeCodigo(codigo: string, preferida: CountryCode): CountryCode {
  if (getCountryCallingCode(preferida) === codigo) return preferida;
  return PRINCIPAL[codigo] ?? getCountries().find((r) => getCountryCallingCode(r) === codigo) ?? preferida;
}

/** Region a phone starts with: Colombia unless a CE / Otro applicant chose a nationality with a dialing region. */
export function regionPorDefecto(tipoDocumento: string | undefined, nacionalidad: string | undefined): CountryCode {
  return (tipoDocumento === "ce" || tipoDocumento === "otro") && nacionalidad && esRegion(nacionalidad) ? nacionalidad : REGION_POR_DEFECTO;
}

/**
 * What the person typed + the selected region -> value kept in the form and the region to show.
 * A valid number becomes E.164 and a different country code wins over the selected region ("+58 ..." pasted
 * under +57); an incomplete one is kept as `+<code><digits>` so it can never validate under another region.
 */
export function resolverTelefono(texto: string, region: CountryCode): { valor: string; region: CountryCode } {
  const t = texto.trim();
  const digitos = t.replace(/\D/g, "");
  if (!digitos) return { valor: "", region };
  const p = parsePhoneNumberFromString(t, region);
  if (p?.isValid()) return { valor: p.number, region: regionDeCodigo(p.countryCallingCode, p.country ?? region) };
  const internacional = t.startsWith("+") ? parsePhoneNumberFromString(t) : undefined;
  if (internacional) {
    const r = regionDeCodigo(internacional.countryCallingCode, internacional.country ?? region);
    return { valor: `+${internacional.countryCallingCode}${internacional.nationalNumber}`, region: r };
  }
  return { valor: `+${getCountryCallingCode(region)}${digitos}`, region };
}

/** Inverse of `resolverTelefono` for display: the national part of a stored value, without the dialing code. */
export function textoNacional(valor: string, region: CountryCode): string {
  if (!valor) return "";
  const p = parsePhoneNumberFromString(valor);
  if (p?.isValid()) return p.nationalNumber;
  const prefijo = `+${getCountryCallingCode(region)}`;
  return valor.startsWith(prefijo) ? valor.slice(prefijo.length) : valor.replace(/^\+/, "");
}

/** Region implied by a stored value (its calling code), else the given one. */
export function regionDeValor(valor: string, region: CountryCode): CountryCode {
  const p = valor ? parsePhoneNumberFromString(valor) : undefined;
  return p?.isValid() ? regionDeCodigo(p.countryCallingCode, p.country ?? region) : region;
}
