// Location derived from what the person typed: the barrio/vereda named in the address (basemap catalog) and its estrato
// moda (DAP Cali 2015, see scripts/build-catalogos-postulacion.mjs). Pure and offline: no geocoder.
import barrios from "../catalogo/barrios.json";
import estratos from "../catalogo/estratos.json";

export type Lugar = { id: string; nombre: string; codigo_division: string };

const ESTRATOS: Record<string, number> = estratos;
/** Estrato moda of a barrio; null for veredas and the few barrios without data (then it is asked). */
export const estratoDeBarrio = (id: string | null | undefined): number | null => (id ? (ESTRATOS[id] ?? null) : null);

const plano = (s: string) =>
  ` ${s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim()} `;

// Longest names first, so "Alfonso Lopez I" wins over "Alfonso Lopez". Very short names would match anything.
const CANDIDATOS = barrios
  .map((b) => ({ b, clave: plano(b.nombre) }))
  .filter((c) => c.clave.trim().length >= 4)
  .sort((x, y) => y.clave.length - x.clave.length);

/**
 * The barrio or vereda named in an address ("Av 5 Norte # 5N-02, Barrio Centenario" -> Centenario). Only the text after
 * the "#" is searched (the street part has names too). Null when none is named or the name is ambiguous.
 */
export function detectarBarrio(direccion: string): Lugar | null {
  const t = plano(direccion);
  const i = t.indexOf("#");
  const zona = i >= 0 ? ` ${t.slice(i + 1)} ` : t;
  const hallado = CANDIDATOS.find((c) => zona.includes(c.clave));
  if (!hallado) return null;
  const iguales = CANDIDATOS.filter((c) => c.clave === hallado.clave);
  if (new Set(iguales.map((c) => c.b.codigo_division)).size > 1) return null; // same name in two comunas: let the person choose
  const { id, nombre, codigo_division } = hallado.b;
  return { id, nombre, codigo_division };
}
