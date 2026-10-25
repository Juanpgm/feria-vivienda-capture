const CAMPOS: Record<string, string> = { password: "contraseña", correo: "correo", nombre: "nombre", rol: "rol" };

/** POSTs JSON and returns an error message in Spanish (or null on success). */
export async function post(url: string, body?: unknown): Promise<{ error: string | null; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { error: null, data };
    const campos = Object.keys((data.campos as object) ?? {}).map((c) => CAMPOS[c] ?? c);
    const detalle = campos.length ? ` Revise: ${campos.join(", ")}.` : "";
    return { error: `${(data.error as string) ?? "No se pudo completar la acción."}${detalle}`, data };
  } catch {
    return { error: "Sin conexión con el servidor. Revise su conexión e intente de nuevo.", data: {} };
  }
}
