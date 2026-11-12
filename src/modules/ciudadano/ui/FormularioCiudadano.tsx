"use client";

import { useEffect, useMemo, useState } from "react";
import { CONSENTIMIENTO_VERSION } from "@/modules/consentimiento/domain/texto";
import { cargarBorrador } from "@/modules/registro/ui/borradores";
import { ModoContext } from "@/modules/registro/ui/modo";
import { Stepper, type DatosCiudadano } from "@/modules/registro/ui/Stepper";
import { AutorizacionDatos } from "./AutorizacionDatos";

type Props = {
  documento: string;
  registroId: string;
  /** Name and document from the eligibility list (forced into the form, never asked). */
  identidad: Record<string, string>;
  /** The single edit: the form reopens with what was sent (photos and signature must be redone). */
  edicion: boolean;
  valoresPrevios: Record<string, Record<string, unknown>> | null;
};

/** Authorization first, then the regular form in citizen mode. The draft lives on this device under the citizen's own key. */
export function FormularioCiudadano({ documento, registroId, identidad, edicion, valoresPrevios }: Props) {
  const uid = `ciudadano:${documento}`;
  const [fase, setFase] = useState<"cargando" | "autorizar" | "formulario">("cargando");
  const [sensibles, setSensibles] = useState(false);

  useEffect(() => {
    // A draft that already carries the authorization (or an edit) skips the gate: it was accepted before.
    cargarBorrador(uid, registroId)
      .catch(() => null)
      .then((b) => setFase(edicion || b?.valores.consentimiento?.acepta_tratamiento === true ? "formulario" : "autorizar"));
  }, [uid, registroId, edicion]);

  const ciudadano = useMemo<DatosCiudadano>(
    () => ({
      identidad,
      semilla: edicion && valoresPrevios ? valoresPrevios : { consentimiento: { acepta_tratamiento: true, acepta_datos_sensibles: sensibles, version: CONSENTIMIENTO_VERSION } },
    }),
    [identidad, edicion, valoresPrevios, sensibles],
  );

  if (fase === "cargando") return <p role="status">Cargando…</p>;
  if (fase === "autorizar")
    return (
      <AutorizacionDatos
        alAceptar={(s) => {
          setSensibles(s);
          setFase("formulario");
        }}
      />
    );
  return (
    <ModoContext.Provider value={{ ciudadano: true, edicion }}>
      <Stepper uid={uid} borradorId={registroId} ciudadano={ciudadano} />
    </ModoContext.Provider>
  );
}
