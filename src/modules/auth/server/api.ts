import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SesionError } from "./sesion";

export const respuesta = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

/** Maps known failures to JSON errors (Spanish); unknown ones are logged without PII. */
export async function conErrores(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SesionError) return respuesta(e.status, { error: e.message });
    if (e instanceof ZodError) {
      // Dotted paths ("solicitante.telefono_1") so nested schemas map to form fields.
      const campos: Record<string, string[]> = {};
      for (const i of e.issues) (campos[i.path.join(".")] ??= []).push(i.message);
      return respuesta(422, { error: "Datos inválidos", campos });
    }
    const code = (e as { code?: string }).code;
    if (code === "auth/email-already-exists") return respuesta(409, { error: "El correo ya está registrado" });
    console.error("api error", code ?? (e as Error).name);
    return respuesta(500, { error: "Error interno" });
  }
}
