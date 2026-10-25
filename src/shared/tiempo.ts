const ZONA = "America/Bogota";

/** Calendar date 'YYYY-MM-DD' in Bogota (UTC-5, no DST). */
export function fechaBogota(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d);
}

/** ISO 8601 with explicit -05:00 offset. */
export function isoBogota(d: Date = new Date()): string {
  return new Date(d.getTime() - 5 * 3600_000).toISOString().replace("Z", "-05:00");
}

/** An ISO instant as `05/03/2026, 3:42 p. m.` in Bogota time (display only). */
export function fechaHoraBogota(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
