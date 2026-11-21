// "Memoria de cálculo": the inspector may type a measured quantity as arithmetic, like the PRESUPUESTO TOPOP
// sheet does (=((1.87+3.4)*(2.7+4.6))*2-1.432). Tiny recursive-descent parser: numbers, + - * x / and
// parentheses only; never eval. Decimal comma or point.

export type ResultadoCantidad = { ok: true; valor: number } | { ok: false; error: string };

export const CANTIDAD_MAX = 1_000_000;

type Token = number | "+" | "-" | "*" | "/" | "(" | ")";

function tokenizar(s: string): Token[] | null {
  const out: Token[] = [];
  const re = /\s*(?:(\d+(?:[.,]\d+)?|[.,]\d+)|([-+*/()xX×]))/y;
  let i = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) return /^\s*$/.test(s.slice(i)) ? out : null;
    if (m[1]) out.push(Number(m[1].replace(",", ".")));
    else out.push(/[xX×]/.test(m[2]) ? "*" : (m[2] as Token));
    i = re.lastIndex;
  }
  return out;
}

export function evaluarCantidad(entrada: string): ResultadoCantidad {
  const fuente = entrada.trim().replace(/^=/, "");
  const invalida = { ok: false as const, error: fuente ? `Revise la operación: ${fuente}` : "Ingrese la cantidad medida" };
  const tokens = (fuente && tokenizar(fuente)) || [];
  if (!tokens.length) return invalida;

  let p = 0;
  const ver = () => tokens[p];
  // expr = term (("+"|"-") term)* ; term = factor (("*"|"/") factor)* ; factor = ("+"|"-") factor | num | "(" expr ")"
  function factor(): number | null {
    const t = tokens[p++];
    if (t === "-" || t === "+") {
      const f = factor();
      return f === null ? null : t === "-" ? -f : f;
    }
    if (typeof t === "number") return t;
    if (t === "(") {
      const v = expr();
      return v !== null && tokens[p++] === ")" ? v : null;
    }
    return null;
  }
  function term(): number | null {
    let v = factor();
    while (v !== null && (ver() === "*" || ver() === "/")) {
      const op = tokens[p++];
      const d = factor();
      v = d === null ? null : op === "*" ? v * d : v / d;
    }
    return v;
  }
  function expr(): number | null {
    let v = term();
    while (v !== null && (ver() === "+" || ver() === "-")) {
      const op = tokens[p++];
      const d = term();
      v = d === null ? null : op === "+" ? v + d : v - d;
    }
    return v;
  }

  const v = expr();
  if (v === null || p !== tokens.length) return invalida;
  if (!Number.isFinite(v)) return { ok: false, error: "La operación no da un número válido" };
  const valor = Math.round(v * 10_000) / 10_000;
  if (valor <= 0) return { ok: false, error: "La cantidad debe ser mayor que cero" };
  if (valor > CANTIDAD_MAX) return { ok: false, error: "La cantidad es demasiado grande" };
  return { ok: true, valor };
}
