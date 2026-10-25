"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { clienteAuth } from "@/shared/firebase/cliente";
import { ALLOWED_EMAIL_DOMAIN } from "@/shared/config";
import { Button } from "@/shared/ui/Button";
import { Field, TextInput } from "@/shared/ui/Field";
import { correoEnDominio } from "../domain/roles";
import { post } from "./post";

const ERRORES_FIREBASE: Record<string, string> = {
  "auth/invalid-credential": "Correo o contraseña incorrectos. Revise los datos e intente de nuevo.",
  "auth/email-already-in-use": "Ya existe una cuenta con este correo. Use Ingresar.",
  "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espere unos minutos e intente de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revise su conexión e intente de nuevo.",
  "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de terminar. Intente de nuevo.",
  "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permita las ventanas emergentes e intente de nuevo.",
};

const ERROR_DOMINIO = `El acceso con Google solo está disponible para cuentas @${ALLOWED_EMAIL_DOMAIN}. Use correo y contraseña si su correo es de otro dominio.`;

/** Exchanges the Firebase ID token for a session cookie. Retries once with a fresh token (claims may lag). */
async function abrirSesion(user: User): Promise<"pendiente" | "aprobado" | "lectura"> {
  let error = "No se pudo iniciar sesión.";
  for (const refrescar of [false, true]) {
    const r = await post("/api/auth/sesion", { idToken: await user.getIdToken(refrescar) });
    if (!r.error) return r.data.estado as "pendiente" | "aprobado" | "lectura";
    error = r.error;
    if (r.status !== 401) break; // only a stale-claims 401 is worth retrying with a fresh token
  }
  throw new Error(error);
}

export function FormAuth({ modo }: { modo: "login" | "registro" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const registro = modo === "registro";
  const accion = registro ? "Crear cuenta" : "Ingresar";

  async function ejecutar(fn: () => Promise<User>) {
    setError("");
    setOcupado(true);
    try {
      const estado = await abrirSesion(await fn());
      await signOut(clienteAuth()); // the server cookie is the only session we use
      router.replace(estado === "pendiente" ? "/pendiente" : "/");
    } catch (e) {
      await signOut(clienteAuth()).catch(() => undefined);
      setError(ERRORES_FIREBASE[(e as { code?: string }).code ?? ""] ?? (e as Error).message);
      setOcupado(false);
    }
  }

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const correo = String(f.get("correo")).trim().toLowerCase();
    const clave = String(f.get("clave"));
    const nombre = String(f.get("nombre") ?? "").trim();
    if (registro && nombre.length < 2) return setError("Escriba su nombre completo.");
    void ejecutar(async () => {
      const auth = clienteAuth();
      if (!registro) return (await signInWithEmailAndPassword(auth, correo, clave)).user;
      const { user } = await createUserWithEmailAndPassword(auth, correo, clave);
      await updateProfile(user, { displayName: nombre });
      return user;
    });
  }

  function google() {
    void ejecutar(async () => {
      const proveedor = new GoogleAuthProvider();
      proveedor.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN }); // hint only; the server enforces the domain
      const { user } = await signInWithPopup(clienteAuth(), proveedor);
      // Early UX check only; the server enforces the rule (and deletes the account) regardless.
      if (!correoEnDominio(user.email)) throw new Error(ERROR_DOMINIO);
      return user;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {registro && (
          <Field label="Nombre completo">
            {(a) => <TextInput {...a} name="nombre" autoComplete="name" required />}
          </Field>
        )}
        <Field label="Correo">
          {(a) => <TextInput {...a} name="correo" type="email" autoComplete="username" required />}
        </Field>
        <Field label="Contraseña" hint={registro ? "Mínimo 8 caracteres" : undefined}>
          {(a) => (
            <TextInput
              {...a}
              name="clave"
              type="password"
              autoComplete={registro ? "new-password" : "current-password"}
              minLength={registro ? 8 : undefined}
              required
            />
          )}
        </Field>
        <p role="alert" className="text-sm font-medium text-danger empty:hidden">
          {error}
        </p>
        <Button type="submit" disabled={ocupado}>
          {accion}
        </Button>
      </form>
      <Button variant="secondary" onClick={google} disabled={ocupado} aria-label={`${accion} con Google`}>
        {accion} con Google
      </Button>
    </div>
  );
}
