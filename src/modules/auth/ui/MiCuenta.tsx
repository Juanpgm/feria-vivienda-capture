"use client";

import { signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { useState, type FormEvent } from "react";
import type { FilaVisita } from "@/modules/mejoramiento/server/visitas.repo";
import { MisVisitas } from "@/modules/mejoramiento/ui/MisVisitas";
import { clienteAuth } from "@/shared/firebase/cliente";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Field, TextArea, TextInput } from "@/shared/ui/Field";
import { Select } from "@/shared/ui/Select";
import { ETIQUETA_ROL, MOTIVO_MAX, type Rol } from "../domain/roles";
import { post } from "./post";

export type DatosCuenta = {
  correo: string;
  rol: Rol;
  proveedor: "password" | "google";
  nombre: string;
  celular: string | null;
  cedula: string | null;
  cargo: string | null;
  solicitud: { rol_solicitado: Rol; motivo: string } | null;
  solicitables: Rol[];
  /** Inspectors only: their visits for "Mis visitas" (S9 9.4). */
  visitas?: FilaVisita[];
};

/** Error + success line shared by the three forms (announced politely). */
function Aviso({ error, ok }: { error: string; ok: string }) {
  return (
    <div aria-live="polite">
      <p role="alert" className="text-sm font-medium text-danger empty:hidden">
        {error}
      </p>
      <p className="text-sm font-medium text-success empty:hidden">{ok}</p>
    </div>
  );
}

function useEnvio() {
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function correr(fn: () => Promise<string | null>, exito: string) {
    setOcupado(true);
    setError("");
    setOk("");
    const e = await fn();
    setOcupado(false);
    if (e) setError(e);
    else setOk(exito);
    return !e;
  }
  return { error, ok, ocupado, correr };
}

function FormDatos({ d }: { d: DatosCuenta }) {
  const { error, ok, ocupado, correr } = useEnvio();
  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    void correr(
      async () => (await post("/api/cuenta/datos", { nombre: f.get("nombre"), celular: f.get("celular"), cedula: f.get("cedula"), cargo: f.get("cargo") })).error,
      "Datos guardados.",
    );
  }
  return (
    <form onSubmit={enviar} className="grid gap-4 md:grid-cols-2">
      <Field label="Nombre completo">{(a) => <TextInput {...a} name="nombre" defaultValue={d.nombre} required autoComplete="name" />}</Field>
      <Field label="Celular" hint="Opcional.">
        {(a) => <TextInput {...a} name="celular" type="tel" inputMode="tel" defaultValue={d.celular ?? ""} autoComplete="tel" />}
      </Field>
      <Field label="Cédula" hint="Opcional.">
        {(a) => <TextInput {...a} name="cedula" inputMode="numeric" defaultValue={d.cedula ?? ""} />}
      </Field>
      <Field label="Cargo" hint="Aparece junto a su firma en las visitas.">
        {(a) => <TextInput {...a} name="cargo" defaultValue={d.cargo ?? ""} />}
      </Field>
      <div className="md:col-span-2">
        <Aviso error={error} ok={ok} />
      </div>
      <div>
        <Button type="submit" disabled={ocupado}>
          Guardar datos
        </Button>
      </div>
    </form>
  );
}

const ERRORES_CLAVE: Record<string, string> = {
  "auth/invalid-credential": "La contraseña actual no es correcta.",
  "auth/wrong-password": "La contraseña actual no es correcta.",
  "auth/too-many-requests": "Demasiados intentos. Espere unos minutos e intente de nuevo.",
  "auth/weak-password": "La nueva contraseña es muy débil.",
  "auth/network-request-failed": "Sin conexión. Revise su conexión e intente de nuevo.",
};

/** Re-authenticates with the current password (client SDK), updates it, and signs the SDK out again. */
function FormClave({ correo }: { correo: string }) {
  const { error, ok, ocupado, correr } = useEnvio();
  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const actual = String(f.get("actual") ?? "");
    const nueva = String(f.get("nueva") ?? "");
    const hecho = await correr(async () => {
      if (nueva.length < 8) return "La nueva contraseña debe tener al menos 8 caracteres.";
      if (nueva !== f.get("confirmar")) return "La confirmación no coincide con la nueva contraseña.";
      if (nueva === actual) return "La nueva contraseña debe ser distinta de la actual.";
      const auth = clienteAuth();
      try {
        const { user } = await signInWithEmailAndPassword(auth, correo, actual);
        await updatePassword(user, nueva);
        return null;
      } catch (e) {
        return ERRORES_CLAVE[(e as { code?: string }).code ?? ""] ?? "No se pudo cambiar la contraseña. Intente de nuevo.";
      } finally {
        await signOut(auth).catch(() => undefined); // the server cookie stays the only session
      }
    }, "Contraseña actualizada. Úsela la próxima vez que ingrese.");
    if (hecho) form.reset();
  }
  return (
    <form onSubmit={enviar} className="grid gap-4 md:grid-cols-3">
      <Field label="Contraseña actual">{(a) => <TextInput {...a} name="actual" type="password" required autoComplete="current-password" />}</Field>
      <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
        {(a) => <TextInput {...a} name="nueva" type="password" required minLength={8} autoComplete="new-password" />}
      </Field>
      <Field label="Confirmar nueva contraseña">
        {(a) => <TextInput {...a} name="confirmar" type="password" required minLength={8} autoComplete="new-password" />}
      </Field>
      <div className="md:col-span-3">
        <Aviso error={error} ok={ok} />
      </div>
      <div>
        <Button type="submit" disabled={ocupado}>
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}

function FormSolicitud({ d }: { d: DatosCuenta }) {
  const { error, ok, ocupado, correr } = useEnvio();
  const [pendiente, setPendiente] = useState(d.solicitud);
  if (pendiente)
    return (
      <p className="text-sm">
        Solicitud enviada para el rol <span className="font-semibold">{ETIQUETA_ROL[pendiente.rol_solicitado]}</span>. Un administrador la
        revisará; cuando se apruebe, su sesión se cerrará y verá el nuevo rol al volver a ingresar.
      </p>
    );
  if (!d.solicitables.length) return <p className="text-sm text-muted">Su cuenta ya tiene el rol más alto.</p>;
  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const rol = f.get("rol") as Rol;
    const motivo = String(f.get("motivo") ?? "");
    void correr(async () => {
      const r = await post("/api/cuenta/solicitud-rol", { rol, motivo });
      if (!r.error) setPendiente({ rol_solicitado: rol, motivo });
      return r.error;
    }, "");
  }
  return (
    <form onSubmit={enviar} className="grid gap-4 md:grid-cols-2">
      <Field label="Rol que necesita">
        {(a) => <Select {...a} name="rol" required options={d.solicitables.map((r) => ({ value: r, label: ETIQUETA_ROL[r] }))} />}
      </Field>
      <div className="md:col-span-2">
        <Field label="Motivo" hint={`Por qué necesita el cambio (máximo ${MOTIVO_MAX} caracteres).`}>
          {(a) => <TextArea {...a} name="motivo" rows={3} required minLength={5} maxLength={MOTIVO_MAX} />}
        </Field>
      </div>
      <div className="md:col-span-2">
        <Aviso error={error} ok={ok} />
      </div>
      <div>
        <Button type="submit" disabled={ocupado}>
          Enviar solicitud
        </Button>
      </div>
    </form>
  );
}

export function MiCuenta({ d }: { d: DatosCuenta }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        {d.correo} · Rol: <span className="font-semibold text-text">{ETIQUETA_ROL[d.rol]}</span>
      </p>
      <Card title="Mis datos">
        <FormDatos d={d} />
      </Card>
      <Card title="Contraseña">
        {d.proveedor === "password" ? (
          <FormClave correo={d.correo} />
        ) : (
          <p className="text-sm text-muted">Usted ingresa con su cuenta de Google; la contraseña se administra en Google.</p>
        )}
      </Card>
      {d.visitas && (
        <Card title="Mis visitas">
          <MisVisitas filas={d.visitas} inspector={{ nombre: d.nombre, cargo: d.cargo }} />
        </Card>
      )}
      <Card title="Solicitar cambio de rol">
        <FormSolicitud d={d} />
      </Card>
    </div>
  );
}
