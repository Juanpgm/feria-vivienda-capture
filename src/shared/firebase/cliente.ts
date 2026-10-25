// Client SDK: used ONLY for Auth sign-in. All data access goes through server routes.
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { clientFirebaseConfig } from "@/shared/config";

export const clienteAuth = () =>
  getAuth(getApps().length ? getApp() : initializeApp(clientFirebaseConfig()));
