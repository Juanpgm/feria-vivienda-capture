"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { TIPOS_FOTO } from "../domain/imagen";
import { useError } from "@/modules/registro/ui/campos";
import { FOTO_CAPTURADA } from "../domain/schema";
import { FotoCaptura } from "./FotoCaptura";

export function PasoDocumentos({ borradorId }: { borradorId: string }) {
  const error = useError();
  const { control } = useFormContext<FieldValues>();
  const frente = useWatch({ control, name: "documentos.documento_frente" }) === FOTO_CAPTURADA;
  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 font-semibold">Para que su registro sea válido necesitamos 2 fotos de su cédula:</p>
        <ol className="list-decimal pl-5">
          <li>Primero, la <strong>parte de adelante</strong>, donde sale su foto.</li>
          <li>Después, la <strong>parte de atrás</strong>.</li>
        </ol>
        <p className="mt-2 text-sm text-muted">
          Con buena luz, sin reflejos y la cédula completa dentro de la foto. No se puede continuar sin las dos fotos. Solo el personal
          administrador puede verlas y quedan guardadas en este equipo hasta que se envíe el registro.
        </p>
      </div>
      {TIPOS_FOTO.map((tipo) => (
        <FotoCaptura
          key={tipo}
          borradorId={borradorId}
          tipo={tipo}
          errorFormulario={error(`documentos.${tipo}`)}
          bloqueada={tipo === "documento_reverso" && !frente ? "Primero tome la foto de la parte de adelante." : undefined}
        />
      ))}
    </div>
  );
}
