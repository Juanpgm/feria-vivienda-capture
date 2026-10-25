"use client";

import { ListaBorradores } from "./ListaBorradores";
import { Stepper } from "./Stepper";

/** /registros/nuevo: without `?borrador=<uuid>` the list of drafts, with it the form of that draft. */
export function EntradaRegistro({ uid, borradorId }: { uid: string; borradorId?: string }) {
  return borradorId ? <Stepper key={borradorId} uid={uid} borradorId={borradorId} /> : <ListaBorradores uid={uid} />;
}
