// Heuristic IGAC-style address normalizer. The original text is always kept by the caller;
// failing to recognize the pattern never blocks (es_completa=false, norm = cleaned uppercase text).

const TIPOS_VIA: Record<string, string> = {
  CALLE: "CL", CLL: "CL", CL: "CL",
  CARRERA: "KR", CRA: "KR", CR: "KR", KRA: "KR", KR: "KR", K: "KR",
  AVENIDA: "AV", AV: "AV", AVDA: "AV",
  DIAGONAL: "DG", DIAG: "DG", DG: "DG",
  TRANSVERSAL: "TV", TRANSV: "TV", TV: "TV",
  AUTOPISTA: "AU", AU: "AU",
  CIRCULAR: "CQ", CQ: "CQ",
};
const NUMERO = new Set(["NO", "NRO", "NUM", "NUMERO", "#"]);
const ORIENTACION: Record<string, string> = { SUR: "SUR", ESTE: "ESTE", NORTE: "NORTE", OESTE: "OESTE" };

const COMPLETA =
  /^(CL|KR|AV|AC|AK|DG|TV|AU|CQ) \d+[A-Z]?( BIS)?( (SUR|ESTE|NORTE|OESTE))? # \d+[A-Z]?( BIS)?-\d+( .+)?$/;

export function normalizarDireccion(raw: string): { norm: string; es_completa: boolean } {
  const limpio = raw
    .toUpperCase()
    .replace(/N[º°]/g, "#")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[º°]/g, "")
    .replace(/[.,;]/g, " ")
    .replace(/#/g, " # ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\b(AVENIDA|AV) (CALLE|CLL|CL)\b/g, "AC")
    .replace(/\b(AVENIDA|AV) (CARRERA|CRA|CR|KRA|KR)\b/g, "AK")
    .trim()
    .replace(/\s+/g, " ");

  const norm = limpio
    .split(" ")
    .map((t) => (NUMERO.has(t) ? "#" : (TIPOS_VIA[t] ?? ORIENTACION[t] ?? t)))
    .join(" ")
    // "12 A" -> "12A" (single letter after a number; N/S/E/O are orientations, left alone)
    .replace(/(\d) ([A-DF-MP-RT-Z])\b/g, "$1$2")
    .replace(/ ?# ?/g, " # ")
    .replace(/\s+/g, " ")
    .trim();

  return { norm, es_completa: COMPLETA.test(norm) };
}
