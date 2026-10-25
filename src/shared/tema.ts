export const CLAVE_TEMA = "tema";

/** Stored explicit choice wins; otherwise follow the OS preference. Mirrored by the inline script in layout.tsx. */
export function resolverTemaOscuro(guardado: string | null, sistemaOscuro: boolean): boolean {
  if (guardado === "oscuro") return true;
  if (guardado === "claro") return false;
  return sistemaOscuro;
}

export function leerTemaGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_TEMA);
  } catch {
    return null;
  }
}

export function guardarTema(oscuro: boolean): void {
  try {
    localStorage.setItem(CLAVE_TEMA, oscuro ? "oscuro" : "claro");
  } catch {
    // Storage blocked: the choice applies for this page only.
  }
}
