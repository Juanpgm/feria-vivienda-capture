"use client";

// Step views of the 6-step form. The per-domain screens stay as they are; a merged step renders them in sequence under
// plain section headings (h3, the step title is the h2). Each heading carries the anchor the "Editar" links jump to.
import type { ComponentType, ReactNode } from "react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { PasoCierreFinanciero } from "@/modules/cierre-financiero/ui/PasoCierreFinanciero";
import { PasoComposicion } from "@/modules/composicion/ui/PasoComposicion";
import { PasoProteccion } from "@/modules/composicion/ui/PasoProteccion";
import { PasoConsentimiento } from "@/modules/consentimiento/ui/PasoConsentimiento";
import { PasoDocumentos } from "@/modules/documentos/ui/PasoDocumentos";
import { PasoHogar } from "@/modules/hogar/ui/PasoHogar";
import { PasoInmueble } from "@/modules/inmueble/ui/PasoInmueble";
import { PasoRiesgo } from "@/modules/riesgo/ui/PasoRiesgo";
import { PasoTitularidad } from "@/modules/titularidad/ui/PasoTitularidad";
import type { DatosConfirmacion } from "./Confirmacion";
import { EnvioRegistro } from "./EnvioRegistro";
import { Resumen } from "./Resumen";
import { anclaDe, fotosHabilitadas } from "./pasos";

export type PropsVista = {
  irAPaso: (id: string, ancla?: string) => void;
  borradorId: string;
  /** Last step only: submit finished (the owner deletes the draft and shows the confirmation) / submit running. */
  alEnviado?: (d: DatosConfirmacion) => void;
  alBloquear?: (ocupado: boolean) => void;
};

function Bloque({ clave, titulo, children }: { clave: string; titulo: string; children: ReactNode }) {
  return (
    <section id={anclaDe(clave)} aria-labelledby={`${anclaDe(clave)}-t`} className="flex scroll-mt-4 flex-col gap-4">
      <h3 id={`${anclaDe(clave)}-t`} tabIndex={-1} className="border-b border-border pb-1 text-xl font-bold text-primary-strong">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

const Compuesto = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-12">{children}</div>;

const PasoHogarFamilia = () => (
  <Compuesto>
    <Bloque clave="composicion" titulo="Composición familiar e ingresos">
      <PasoComposicion />
    </Bloque>
    <Bloque clave="proteccion" titulo="Especial protección constitucional">
      <PasoProteccion />
    </Bloque>
  </Compuesto>
);

const PasoVivienda = () => (
  <Compuesto>
    <Bloque clave="inmueble" titulo="Inmueble y ubicación">
      <PasoInmueble />
    </Bloque>
    <Bloque clave="riesgo" titulo="Riesgo y dictamen técnico">
      <PasoRiesgo />
    </Bloque>
    <Bloque clave="titularidad" titulo="Titularidad">
      <PasoTitularidad />
    </Bloque>
  </Compuesto>
);

/** The consent comes first; the photos stay locked until the treatment of personal data is authorized. */
function PasoAutorizacionDocumento({ borradorId }: PropsVista) {
  const { control } = useFormContext<FieldValues>();
  const aceptado = useWatch({ control, name: "consentimiento.acepta_tratamiento" });
  const habilitadas = fotosHabilitadas({ consentimiento: { acepta_tratamiento: aceptado } });
  return (
    <Compuesto>
      <Bloque clave="consentimiento" titulo="Autorización de datos">
        <PasoConsentimiento />
      </Bloque>
      <Bloque clave="documentos" titulo="Documento de identidad">
        {habilitadas ? (
          <PasoDocumentos borradorId={borradorId} />
        ) : (
          <p id="fotos-bloqueadas" role="status" className="rounded-lg border border-border bg-surface p-3 text-muted">
            Las fotos se habilitan cuando el titular autoriza el tratamiento de sus datos personales, en la sección anterior.
          </p>
        )}
      </Bloque>
    </Compuesto>
  );
}

const PasoRevisionFirma = (p: PropsVista) => (
  <Compuesto>
    <Resumen irAPaso={p.irAPaso} />
    <EnvioRegistro irAPaso={p.irAPaso} borradorId={p.borradorId} alEnviado={p.alEnviado} alBloquear={p.alBloquear} />
  </Compuesto>
);

export const VISTAS: Record<string, ComponentType<PropsVista>> = {
  solicitante: PasoHogar,
  hogar: PasoHogarFamilia,
  vivienda: PasoVivienda,
  financiero: PasoCierreFinanciero,
  autorizacion: PasoAutorizacionDocumento,
  revision: PasoRevisionFirma,
};
