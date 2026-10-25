"use client";

import { CONDICIONES_ESPECIALES } from "@/shared/constantes";
import { CasillasExclusivas } from "@/modules/registro/ui/campos";

export function PasoProteccion() {
  return (
    <CasillasExclusivas
      name="composicion.condiciones_especiales"
      legend="Condiciones del solicitante o su hogar"
      ayuda="Marque todas las que apliquen. Si ninguna aplica, marque «Ninguna»."
      opciones={CONDICIONES_ESPECIALES}
    />
  );
}
