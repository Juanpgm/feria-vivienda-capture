// Server-only: never import from client components (holds service-account credentials).
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { adminFirebaseConfig } from "@/shared/config";

function app() {
  return getApps()[0] ?? initializeApp({ credential: cert(adminFirebaseConfig()) });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
