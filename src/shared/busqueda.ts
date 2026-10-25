export type OpcionBusqueda = { value: string; label: string; keywords?: string };

/** Lowercase, strip diacritics, collapse whitespace: "  ÁNGEL  María " -> "angel maria". */
export function normalizarBusqueda(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Accent- and case-insensitive filter. Every query word must prefix-match a word of label/keywords
 * (or appear inside it for words of 3+ chars). Ranking: label starts with query, then word-prefix matches,
 * then substring matches; ties keep input order.
 */
export function filtrarOpciones<T extends OpcionBusqueda>(opciones: readonly T[], consulta: string, limite = 50): T[] {
  const q = normalizarBusqueda(consulta);
  if (!q) return opciones.slice(0, limite);
  const palabras = q.split(" ");
  const puntuadas: { o: T; rank: number; i: number }[] = [];
  opciones.forEach((o, i) => {
    const texto = normalizarBusqueda(`${o.label} ${o.keywords ?? ""}`);
    const tokens = texto.split(" ");
    let rank = normalizarBusqueda(o.label).startsWith(q) ? 0 : 1;
    for (const p of palabras) {
      if (tokens.some((t) => t.startsWith(p))) continue;
      if (p.length >= 3 && texto.includes(p)) rank = 2;
      else return;
    }
    puntuadas.push({ o, rank, i });
  });
  return puntuadas.sort((a, b) => a.rank - b.rank || a.i - b.i).slice(0, limite).map((x) => x.o);
}
