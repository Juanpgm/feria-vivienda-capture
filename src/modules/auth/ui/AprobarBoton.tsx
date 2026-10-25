"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import { post } from "./post";

export function AprobarBoton({ uid, nombre }: { uid: string; nombre: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function aprobar() {
    setOcupado(true);
    const r = await post(`/api/usuarios/${uid}/aprobar`);
    setError(r.error ?? "");
    setOcupado(false);
    if (!r.error) router.refresh();
  }

  return (
    <div>
      <Button onClick={aprobar} disabled={ocupado} aria-label={`Aprobar a ${nombre}`}>
        Aprobar
      </Button>
      <p role="alert" className="mt-1 text-sm text-danger empty:hidden">
        {error}
      </p>
    </div>
  );
}
