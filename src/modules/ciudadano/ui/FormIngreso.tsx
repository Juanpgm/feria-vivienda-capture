"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { post } from "@/modules/auth/ui/post";
import { Button } from "@/shared/ui/Button";
import { Field, TextInput } from "@/shared/ui/Field";

/** Citizen login: document number + password (the same number). */
export function FormIngreso() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setError("");
    setOcupado(true);
    const r = await post("/api/ciudadano/ingresar", { documento: String(f.get("documento")), clave: String(f.get("clave")) });
    if (r.error) {
      setError(r.error);
      setOcupado(false);
      return;
    }
    router.replace("/ciudadano/registro");
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <Field label="Número de documento" hint="Solo el número, sin puntos ni espacios.">
        {(a) => <TextInput {...a} name="documento" inputMode="numeric" autoComplete="off" required />}
      </Field>
      <Field label="Contraseña" hint="Es el mismo número de su documento de identidad.">
        {(a) => <TextInput {...a} name="clave" type="password" inputMode="numeric" autoComplete="off" required />}
      </Field>
      <p role="alert" className="text-sm font-medium text-danger empty:hidden">
        {error}
      </p>
      <Button type="submit" disabled={ocupado}>
        Ingresar
      </Button>
    </form>
  );
}
