// Creates (or repairs) the first superadmin. Idempotent: safe to run again.
// Usage: node --env-file=.env.local scripts/bootstrap-superadmin.mjs --email correo@ejemplo.com [--password 'min 8 chars']
// Any email domain is accepted. Without --password the account can only sign in with Google,
// which requires an @cali.gov.co email: for any other domain, pass --password.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const email = arg("email")?.trim().toLowerCase();
const password = arg("password");
if (!email?.includes("@")) {
  console.error("Falta --email o no es un correo válido.");
  process.exit(1);
}
if (password && password.length < 8) {
  console.error("--password debe tener al menos 8 caracteres.");
  process.exit(1);
}

const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
if (!raw) {
  console.error("Falta FIREBASE_SERVICE_ACCOUNT (use --env-file=.env.local).");
  process.exit(1);
}
const account = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
const app = initializeApp({ credential: cert(account), projectId: process.env.FIREBASE_PROJECT_ID || account.project_id });
const auth = getAuth(app);
const db = getFirestore(app);

let user = await auth.getUserByEmail(email).catch((e) => {
  if (e.code === "auth/user-not-found") return null;
  throw e;
});
if (!user) {
  user = await auth.createUser({ email, password, displayName: email, emailVerified: true });
  console.log(`Usuario creado en Auth: ${user.uid}`);
}

await auth.setCustomUserClaims(user.uid, { rol: "superadmin", aprobado: true });

const ref = db.collection("usuarios").doc(user.uid);
const existe = (await ref.get()).exists;
await ref.set(
  {
    correo: email,
    nombre: user.displayName || email,
    rol: "superadmin",
    esta_aprobado: true,
    proveedor: password || user.passwordHash ? "password" : "google",
    aprobado_en: FieldValue.serverTimestamp(),
    id_usuario_aprobador: "bootstrap",
    actualizado_en: FieldValue.serverTimestamp(),
    ...(existe ? {} : { creado_en: FieldValue.serverTimestamp() }),
  },
  { merge: true },
);
await ref.collection("auditoria").add({ accion: "bootstrap_superadmin", rol: "superadmin", id_usuario_actor: "bootstrap", en: FieldValue.serverTimestamp() });

console.log(`Listo: ${email} es superadmin. Debe cerrar sesión e ingresar de nuevo para recibir los permisos.`);
