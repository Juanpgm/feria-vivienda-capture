import { existsSync } from "node:fs";

/** Saved by `npm run e2e:login` (gitignored). Holds the session cookie only, never the password. */
export const ESTADO_AUTH = ".auth/state.json";

export const MENSAJE_SIN_SESION =
  "No hay sesión guardada para las pruebas e2e. Ejecute una sola vez `npm run e2e:login`, inicie sesión " +
  "con el superadministrador en la ventana que se abre y vuelva a correr `npm run e2e`.";

export const hayEstadoAuth = () => existsSync(ESTADO_AUTH);
