# Setup

What must be provisioned by hand before the app works. Nothing here has been run against a real Firebase project yet.

## 1. Firebase project

1. Create (or reuse) a project in the Firebase Console. If its ID is not `feria-vivienda`, update `.firebaserc`.
2. Build > Authentication > Sign-in method: enable **Email/Password** and **Google**.
3. Build > Firestore Database: create a database (production mode; the rules in this repo deny all client access).
4. Authentication > Settings > Authorized domains: add the Vercel domain (and the custom domain, if any).

## 2. Environment variables

Create `.env.local` (git-ignored) with this template. Use the same names in Vercel.

```bash
# --- Client config (public) ---
# Firebase Console > Project settings > General > Your apps > Web app > SDK setup and configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
# Optional
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=

# --- Server only (secret) ---
# Firebase Console > Project settings > Service accounts > Generate new private key.
# Paste the whole JSON file on ONE line, or base64-encode it. Replaces CLIENT_EMAIL / PRIVATE_KEY.
FIREBASE_SERVICE_ACCOUNT=
# Optional: defaults to project_id inside the service account
# FIREBASE_PROJECT_ID=

# --- Radicado ---
# Prefix of the human-friendly radicado (FV-000123). 1-6 letters/digits; optional, defaults to FV.
# RADICADO_PREFIJO=FV

# --- Emulators (local development only) ---
# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
# FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

Note: agents cannot write `.env*` files (permission settings), so `RADICADO_PREFIJO` is documented here only; add it by hand if you want a prefix other than `FV`. Set the same value in Vercel before the first registro: changing it later only affects new radicados.

Never commit the service account file or its contents.

## 3. First superadmin

After step 2, with the dependencies installed (`npm install`):

```bash
node --env-file=.env.local scripts/bootstrap-superadmin.mjs --email correo@ejemplo.com --password 'at least 8 chars'
```

- Any email domain is accepted. Use `--password` for non-`@cali.gov.co` emails: without it the account can only sign in with Google, which is restricted to `@cali.gov.co`.
- Safe to re-run: it reuses the existing Auth user and rewrites the claims and the `usuarios` document.
- The person must sign out and sign in again to receive the claims.

From then on, superadmins approve accounts and create admins at `/admin/usuarios`.

Access rule (enforced server-side in `/api/auth/sesion` from the ID token's `firebase.sign_in_provider`):

- Google sign-in requires a verified `@cali.gov.co` email; other Google accounts are rejected and deleted.
- Email+password accounts (self-registered or admin-created) may use any domain.
- Every account, whatever the provider, needs approval by an admin (usuarios only) or superadmin (any role) before it can enter data.
- Unapproved Google `@cali.gov.co` users get a session cookie and can see the read-only pages (`RUTAS_SOLO_LECTURA` in `roles.ts`); unapproved password users get no cookie and land on `/pendiente`.
- `requireSesion` is strict by default (approval required). Read-only API routes must opt in with `{ permitirPendiente: true }`.
- After approval, a user holding an old pending session must sign out and in again to receive the new claims.

## 4. Firestore rules and indexes

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

## 5. Vercel

Import the repository and add every variable from step 2 (Production and Preview). `FIREBASE_SERVICE_ACCOUNT` must be marked as sensitive. Deploy.

## 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000. Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## 7. Registro model (collection `registros/{id}`, `version_esquema` 2)

`id` is the client UUID (idempotency key). Everything below is written by the server in ONE transaction in `crearRegistro`; none of it is accepted from the client.

| Field | Meaning |
|---|---|
| `radicado`, `radicado_numero` | `FV-000123` and its consecutive. Taken from the counter doc `contadores/radicado` (`ultimo`) inside the same transaction; a retry with the same id returns the same radicado and consumes no number. |
| `registrado_por_uid` / `_nombre` / `_correo` | Who created it. uid and correo come from the verified session; nombre from `usuarios/{uid}.nombre` (falls back to the email local part). Replaces the old `id_usuario_registro`. |
| `registrado_en`, `fecha_registro_bogota` | Server timestamp and the Bogota calendar date (`YYYY-MM-DD`). |
| `estado` | Lifecycle: `registrado` now (`anulado` later). |
| `estado_revision`, `estado_revision_en`, `estado_revision_por_uid` / `_correo` | Internal SGOV review (`ESTADOS_REVISION`): `pendiente_revision` (initial), `habilitado`, `no_habilitado`, `pendiente_subsanacion`. NOT a form field; independent from `estado`. Changing it (admins, with historial) is a later PR. |
| `documento_clave`, `documento_digitos` | Normalized document number (any tipo) and its digits-only form (>= 5 digits, no leading zeros): indexed keys for duplicate detection (exact / similar). |
| `nombre_busqueda` | Lowercase, accent-free full name, for prefix search. |
| `solicitante`, `composicion`, `inmueble`, `riesgo`, `titularidad`, `cierre_financiero`, `observaciones` | Validated form data (split names, derived fields). |
| `consentimiento` | `{ version, hash, acepta_tratamiento, acepta_datos_sensibles, aceptado_en, registrado_por }`. `version` is the wording id the person saw (`CONSENTIMIENTO_VERSION`, e.g. `2026-10-v1`); `hash` is the sha256 of version + text computed by the server; `aceptado_en` is a server timestamp. No consent (or an outdated `version`) answers 422. The wording lives in `src/modules/consentimiento/domain/texto.ts` and is a DRAFT pending legal validation by the Secretaría (the contact channels are placeholders). |
| `composicion.condiciones_especiales` | When `acepta_datos_sensibles` is false the server stores only `["no_autorizado"]` (the selection is dropped). |
| `firma` | `{ metodo_firma: "dibujada" \| "verificacion_manual", firmado_en }` plus, for the manual one, `metodo_verificacion` (`firma_papel`/`huella`/`otro`), `nota_verificacion` (>= 10 chars) and `verificado_por_uid` / `_nombre` / `_correo` (the funcionario of the session). Without it the POST answers 422. The drawn image is NOT here: it is the attachment `adjuntos/firma`. |
| `adjuntos_requeridos`, `adjuntos_presentes`, `adjuntos_completos` | Completeness. Required = 2 photos (+ the signature image when drawn: 3). Created as `0`/`false`; ONLY `POST /api/registros/[id]/completar` sets them, after listing `registros/{id}/adjuntos` on the server. The list and the detail show "Incompleto" while `adjuntos_completos` is false. |
| `historial/{auto}` (subcollection) | `{ tipo: "creacion", estado_revision, por_uid, por_nombre, por_correo, en }`; one entry on creation. |

API: `POST /api/registros` (create), `GET /api/registros` (list: `q`, `nombre`, `comuna`, `barrio`, `estado_revision`, `registrado_por`, `desde`, `hasta`, `limite` 1-100 default 25, `cursor`; newest first, alphabetical when `nombre` is used and then dates cannot be combined), `GET /api/registros/[id]`, `GET /api/registros/duplicado?tipo=&numero=`. A `usuario` only sees their own registros; admin/superadmin see all. Photos and signature are never returned.

Submit sequence (client, `domain/envio.ts`): `POST /api/registros` (idempotent by the draft uuid, returns `radicado` and `registrado_en`) -> `POST /api/registros/[id]/adjuntos` once per file (2 photos, + signature when drawn) -> `POST /api/registros/[id]/completar`. A failure never creates a second registro: the retry reuses the radicado and uploads only what is missing. The draft and its photos are deleted only after `completar` answers `completo: true`.

Composite indexes for these queries are in `firestore.indexes.json`: deploy them (step 4) before using the list with filters, otherwise a filtered query answers 400 until the index finishes building.
