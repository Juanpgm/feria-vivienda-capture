const ZONA = "America/Bogota";

/** Calendar date 'YYYY-MM-DD' in Bogota (UTC-5, no DST). */
export function fechaBogota(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d);
}

/** ISO 8601 with explicit -05:00 offset. */
export function isoBogota(d: Date = new Date()): string {
  return new Date(d.getTime() - 5 * 3600_000).toISOString().replace("Z", "-05:00");
}
