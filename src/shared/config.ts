/** Fixed business constant, not an env var. */
export const ALLOWED_EMAIL_DOMAIN = "cali.gov.co";

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

/**
 * Server-only credentials. Never import from client components. Lazy so builds work without secrets.
 * FIREBASE_SERVICE_ACCOUNT is the service account JSON file, pasted as-is (single line) or base64-encoded.
 */
export function adminFirebaseConfig() {
  const raw = required("FIREBASE_SERVICE_ACCOUNT", process.env.FIREBASE_SERVICE_ACCOUNT).trim();
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const account = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || account.project_id,
    clientEmail: account.client_email,
    privateKey: account.private_key,
  };
}
