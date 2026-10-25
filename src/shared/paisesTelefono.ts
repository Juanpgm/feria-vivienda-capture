import { getCountries, getCountryCallingCode } from "libphonenumber-js/min";
import type { OpcionBusqueda } from "./busqueda";

/** Flag emoji from an ISO 3166-1 alpha-2 code (regional indicator symbols). Some platforms render the letters instead. */
export const bandera = (iso: string) => String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0)));

let memo: OpcionBusqueda[] | undefined;

/** Every country with a dialing code, Spanish names, sorted A-Z; searchable by name, ISO code or dial code ("+58", "58"). */
export function opcionesPaisTelefono(): OpcionBusqueda[] {
  if (memo) return memo;
  const nombres = new Intl.DisplayNames(["es-CO"], { type: "region" });
  memo = getCountries()
    .map((iso) => ({ iso, nombre: nombres.of(iso) ?? iso, codigo: getCountryCallingCode(iso) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map(({ iso, nombre, codigo }) => ({
      value: iso,
      label: `${bandera(iso)} ${nombre} +${codigo}`,
      corta: `${bandera(iso)} +${codigo}`,
      keywords: `${codigo} ${iso}`,
    }));
  return memo;
}
