/** Fixed business constant, not an env var. */
export const ALLOWED_EMAIL_DOMAIN = "cali.gov.co";

/** Prefix of the human-friendly radicado (`FV-000123`). Env RADICADO_PREFIJO, 1-6 letters/digits, default FV. */
export function radicadoPrefijo(): string {
  const p = (process.env.RADICADO_PREFIJO ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{1,6}$/.test(p) ? p : "FV";
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/**
 * NEXT_PUBLIC_* must be referenced literally so Next.js can inline them in the client bundle.
 * Safe to import from client code.
 */
export function clientFirebaseConfig() {
  return {
    apiKey: required("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: required("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: required("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    appId: required("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    messagingSenderId: required(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
  };
}

type CuentaServicio = { project_id: string; client_email: string; private_key: string };

/** Escapes raw control characters that sit inside JSON strings (e.g. a private_key pasted with real line breaks). */
function escaparControlesEnCadenas(s: string): string {
  let salida = "";
  let dentro = false;
  let escape = false;
  for (const c of s) {
    if (dentro && !escape && (c === "\n" || c === "\r" || c === "\t")) {
      salida += c === "\n" ? "\\n" : c === "\r" ? "\\r" : "\\t";
      continue;
    }
    if (c === '"' && !escape) dentro = !dentro;
    escape = c === "\\" && !escape;
    salida += c;
  }
  return salida;
}

function intentarJson(texto: string): unknown {
  for (const candidato of [texto, escaparControlesEnCadenas(texto)]) {
    try {
      return JSON.parse(candidato);
    } catch {
      /* try the next repair */
    }
  }
  return undefined;
}

/**
 * Reads a service account from the value of FIREBASE_SERVICE_ACCOUNT. Tolerates the usual paste mistakes:
 * plain JSON, pretty-printed JSON, wrapping quotes, a JSON-encoded string, real line breaks inside the private
 * key and base64. On failure it throws a structural hint only (never any part of the value).
 */
export function parseServiceAccount(valor: string): CuentaServicio {
  const crudo = valor.replace(/^﻿/, "").trim();
  const candidatos: string[] = [crudo];
  const comillas = crudo.length > 1 && (crudo[0] === '"' || crudo[0] === "'") && crudo.at(-1) === crudo[0];
  if (comillas) candidatos.push(crudo.slice(1, -1));
  if (!crudo.startsWith("{")) {
    for (const c of [crudo, comillas ? crudo.slice(1, -1) : ""]) {
      if (!c) continue;
      try {
        candidatos.push(Buffer.from(c.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8").trim());
      } catch {
        /* not base64 */
      }
    }
  }
  for (const c of candidatos) {
    let valorJson = intentarJson(c);
    if (typeof valorJson === "string") valorJson = intentarJson(valorJson.trim()); // JSON-encoded string
    const o = valorJson as Partial<CuentaServicio> | undefined;
    if (o && typeof o === "object" && o.client_email && o.private_key) {
      return {
        project_id: String(o.project_id ?? ""),
        client_email: o.client_email,
        private_key: o.private_key.includes("\\n") ? o.private_key.replace(/\\n/g, "\n") : o.private_key,
      };
    }
  }
  throw new Error(
    `FIREBASE_SERVICE_ACCOUNT no es un JSON de cuenta de servicio válido (longitud ${crudo.length}, ` +
      `primer carácter ${JSON.stringify(crudo[0] ?? "")}, último ${JSON.stringify(crudo.at(-1) ?? "")}, ` +
      `saltos de línea ${(crudo.match(/\n/g) ?? []).length}). Péguelo en una sola línea o en base64.`,
  );
}

/**
 * Server-only credentials. Never import from client components. Lazy so builds work without secrets.
 * FIREBASE_SERVICE_ACCOUNT is the service account JSON file, pasted as-is or base64-encoded.
 */
export function adminFirebaseConfig() {
  const account = parseServiceAccount(required("FIREBASE_SERVICE_ACCOUNT", process.env.FIREBASE_SERVICE_ACCOUNT));
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || account.project_id,
    clientEmail: account.client_email,
    privateKey: account.private_key,
  };
}
