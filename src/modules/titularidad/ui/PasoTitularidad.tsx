"use client";

import { useFormContext } from "react-hook-form";
import { TITULARIDADES } from "@/shared/constantes";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { CampoTexto, useError } from "@/modules/registro/ui/campos";

const P = "titularidad.";

export function PasoTitularidad() {
  const { register } = useFormContext();
  const error = useError();
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-primary-strong">Relación con el inmueble</h3>
        <SegmentedControl
          legend="El solicitante es"
          name={P + "tipo_titularidad"}
          options={Object.entries(TITULARIDADES).map(([value, label]) => ({ value, label }))}
          error={error(P + "tipo_titularidad")}
          inputProps={register(P + "tipo_titularidad")}
        />
      </section>
      <div className="max-w-sm">
        <CampoTexto
          name={P + "numero_matricula_inmobiliaria"}
          label="Número de matrícula (opcional)"
          autoComplete="off"
          hint="Puede dejarlo vacío si no lo tiene a la mano"
          normalizar={(v) => v.trim()}
        />
      </div>
    </div>
  );
}
