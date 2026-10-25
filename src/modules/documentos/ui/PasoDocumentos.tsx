"use client";

import { TIPOS_FOTO } from "../domain/imagen";
import { useError } from "@/modules/registro/ui/campos";
import { FotoCaptura } from "./FotoCaptura";

export function PasoDocumentos({ borradorId }: { borradorId: string }) {
  const error = useError();
  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted">
        Tome o elija una foto clara de cada lado del documento de identidad del solicitante. Ambas son obligatorias. Las fotos solo
        pueden ser vistas por el personal administrador y quedan guardadas en este equipo hasta que se envíe el registro.
      </p>
      {TIPOS_FOTO.map((tipo) => (
        <FotoCaptura key={tipo} borradorId={borradorId} tipo={tipo} errorFormulario={error(`documentos.${tipo}`)} />
      ))}
    </div>
  );
}
