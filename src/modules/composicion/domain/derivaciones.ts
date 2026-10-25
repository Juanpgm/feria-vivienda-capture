import type { BandaAdultoMayor, BandaHogar } from "@/shared/constantes";

export function bandaHogar(personas: number): BandaHogar {
  return personas <= 1 ? "1" : personas <= 3 ? "2_3" : "4_mas";
}

/**
 * Band by the oldest older adult. PDF: ">74" and "65-73" leave 74 uncovered;
 * 74 is placed in "65_73" (documented ambiguity). Ages under 65 count as none.
 */
export function bandaAdultoMayor(edades: readonly number[]): BandaAdultoMayor {
  const max = Math.max(0, ...edades);
  return max > 74 ? "mayor_74" : max >= 65 ? "65_73" : "ninguno";
}

/** Whole years between ISO dates (YYYY-MM-DD) as of `hoy` (also ISO, Bogota date). */
export function calcularEdad(fechaNacimiento: string, hoy: string): number {
  const [ny, nm, nd] = fechaNacimiento.split("-").map(Number);
  const [hy, hm, hd] = hoy.split("-").map(Number);
  return hy - ny - (hm < nm || (hm === nm && hd < nd) ? 1 : 0);
}
