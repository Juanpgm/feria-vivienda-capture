// The Excel of citizens has ONE full-name column ("NOMBRES APELLIDOS"); the registro needs split names.
// Best effort: `nombre_completo` of the record is rebuilt from these parts, so no word is ever lost.
const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "SAN", "SANTA", "Y"]);

/** "JUAN DE DIOS PEREZ" -> ["JUAN", "DE DIOS", "PEREZ"]: particles stick to the word that follows. */
function unidades(completo: string): string[] {
  const palabras = completo.trim().split(/\s+/).filter(Boolean);
  const u: string[] = [];
  let pendiente = "";
  for (const p of palabras) {
    pendiente = pendiente ? `${pendiente} ${p}` : p;
    if (!PARTICULAS.has(p.toUpperCase())) {
      u.push(pendiente);
      pendiente = "";
    }
  }
  if (pendiente) u.push(pendiente);
  return u;
}

export type NombreSeparado = { primer_nombre: string; segundo_nombre: string; primer_apellido: string; segundo_apellido: string };

/** 1 unit: nombre=apellido; 2: N A; 3: N A A; 4: N N A A; 5+: the extra units are middle names. */
export function separarNombre(completo: string): NombreSeparado {
  const u = unidades(completo);
  const n = u.length;
  if (n <= 1) return { primer_nombre: u[0] ?? "", segundo_nombre: "", primer_apellido: u[0] ?? "", segundo_apellido: "" };
  if (n === 2) return { primer_nombre: u[0], segundo_nombre: "", primer_apellido: u[1], segundo_apellido: "" };
  if (n === 3) return { primer_nombre: u[0], segundo_nombre: "", primer_apellido: u[1], segundo_apellido: u[2] };
  return { primer_nombre: u[0], segundo_nombre: u.slice(1, n - 2).join(" "), primer_apellido: u[n - 2], segundo_apellido: u[n - 1] };
}
