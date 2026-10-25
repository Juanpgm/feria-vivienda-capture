/**
 * Toggles `codigo` in a multi-selection. `exclusiva` (e.g. "ninguna") deselects everything else when chosen,
 * and is dropped when any other option is chosen. Order of insertion is kept.
 */
export function alternarSeleccion(actual: readonly string[], codigo: string, marcada: boolean, exclusiva?: string): string[] {
  if (exclusiva && codigo === exclusiva) return marcada ? [exclusiva] : [];
  const resto = actual.filter((c) => c !== codigo && c !== exclusiva);
  return marcada ? [...resto, codigo] : resto;
}
