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

# --- Emulators (local development only) ---
# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
# FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

Never commit the service account file or its contents.

## 3. First superadmin

After step 2, with the dependencies installed (`npm install`):

```bash
node --env-file=.env.local scripts/bootstrap-superadmin.mjs --email nombre@cali.gov.co
```

- Add `--password 'at least 8 chars'` to create a password login. Without it, the account signs in with Google.
- Safe to re-run: it reuses the existing Auth user and rewrites the claims and the `usuarios` document.
- The person must sign out and sign in again to receive the claims.

From then on, superadmins approve accounts and create admins at `/admin/usuarios`.

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
