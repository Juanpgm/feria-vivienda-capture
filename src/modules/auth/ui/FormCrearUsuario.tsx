"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ALLOWED_EMAIL_DOMAIN } from "@/shared/config";
import { Button } from "@/shared/ui/Button";
import { Field, TextInput } from "@/shared/ui/Field";
import { Select } from "@/shared/ui/Select";
import { post } from "./post";

export function FormCrearUsuario({ puedeElegirRol }: { puedeElegirRol: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    setOk("");
    setOcupado(true);
    const r = await post("/api/usuarios", {
      nombre: f.get("nombre"),
      correo: f.get("correo"),
      password: f.get("clave") || undefined,
      rol: f.get("rol") || undefined,
    });
    setOcupado(false);
    setError(r.error ?? "");
    if (r.error) return;
    form.reset();
    setOk("Usuario creado y aprobado.");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="grid gap-4 md:grid-cols-2">
      <Field label="Nombre completo">{(a) => <TextInput {...a} name="nombre" required />}</Field>
      <Field label="Correo institucional" hint={`Debe terminar en @${ALLOWED_EMAIL_DOMAIN}`}>
        {(a) => <TextInput {...a} name="correo" type="email" required />}
      </Field>
      <Field label="Contraseña" hint="Opcional. Sin contraseña, la persona solo podrá ingresar con Google.">
        {(a) => <TextInput {...a} name="clave" type="password" minLength={8} autoComplete="new-password" />}
      </Field>
      {puedeElegirRol && (
        <Field label="Rol" hint="Si no se elige, la cuenta se crea como usuario.">
          {(a) => (
            <Select
              {...a}
              name="rol"
              placeholder="Usuario"
              options={[
                { value: "admin", label: "Administrador" },
                { value: "superadmin", label: "Superadministrador" },
              ]}
            />
          )}
        </Field>
      )}
      <div className="md:col-span-2" aria-live="polite">
        <p role="alert" className="text-sm font-medium text-danger empty:hidden">
          {error}
        </p>
        <p className="text-sm font-medium text-success empty:hidden">{ok}</p>
      </div>
      <div>
        <Button type="submit" disabled={ocupado}>
          Crear usuario
        </Button>
      </div>
    </form>
  );
}
