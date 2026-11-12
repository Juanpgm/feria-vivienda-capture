"use client";

import { createContext, useContext } from "react";

/** Who is filling the form. The citizen self-service flow reuses the same steps with a few differences. */
export type ModoRegistro = {
  ciudadano: boolean;
  /** Citizen only: the single modification of an already sent registro. */
  edicion: boolean;
};

export const ModoContext = createContext<ModoRegistro>({ ciudadano: false, edicion: false });
export const useModo = () => useContext(ModoContext);

export type Rutas = { crear: string; adjuntos: (id: string) => string; completar: (id: string) => string };

export const RUTAS_FUNCIONARIO: Rutas = {
  crear: "/api/registros",
  adjuntos: (id) => `/api/registros/${encodeURIComponent(id)}/adjuntos`,
  completar: (id) => `/api/registros/${encodeURIComponent(id)}/completar`,
};
export const RUTAS_CIUDADANO: Rutas = {
  crear: "/api/ciudadano/registro",
  adjuntos: () => "/api/ciudadano/registro/adjuntos",
  completar: () => "/api/ciudadano/registro/completar",
};
