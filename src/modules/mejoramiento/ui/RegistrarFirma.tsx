"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/modules/auth/ui/post";
import { PadFirma } from "@/modules/firma/ui/PadFirma";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";

/** Shown instead of any page to an inspector who has no registered signature yet (S8). */
export function RegistrarFirma({ nombre }: { nombre: string }) {
  const router = useRouter();
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    if (!firma) return;
    setOcupado(true);
    setError("");
    const r = await post("/api/cuenta/firma", { firma });
    setOcupado(false);
    if (r.error) return setError(r.error);
    router.refresh();
  }

  return (
    <Card title="Registre su firma de inspector">
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          {nombre}, su cuenta ahora tiene el rol <span className="font-semibold">Inspector</span>. Antes de continuar, firme a mano en el recuadro.
          Esta firma se usará como firma del funcionario en todas sus visitas; solo se pide una vez.
        </p>
        {firma ? (
          <div className="flex flex-col items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
            <img src={firma} alt="Vista previa de su firma" className="w-full max-w-xl rounded-lg border border-border bg-white" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={guardar} disabled={ocupado}>
                Guardar firma
              </Button>
              <Button variant="secondary" onClick={() => setFirma(null)} disabled={ocupado}>
                Firmar de nuevo
              </Button>
            </div>
          </div>
        ) : (
          <PadFirma
            onConfirmar={(url) => {
              if (url.startsWith("data:image/png")) setFirma(url);
              else setError("La firma quedó muy pesada. Bórrela y firme con un trazo más simple.");
            }}
          />
        )}
        <p role="alert" className="text-sm font-medium text-danger empty:hidden">
          {error}
        </p>
      </div>
    </Card>
  );
}
