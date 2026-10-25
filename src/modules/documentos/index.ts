// Client-side public API of the documentos module (the server side is imported by path from the route handlers).
export { FotosResumen } from "./ui/FotosResumen";
export { PasoDocumentos } from "./ui/PasoDocumentos";
export { DocumentosAdmin } from "./ui/DocumentosAdmin";
export { descartarFotos } from "./ui/fotos";
export { enviarAdjunto, subirAdjuntos, type ResultadoAdjunto } from "./ui/subirAdjuntos";
export { TIPOS_FOTO, type TipoAdjunto } from "./domain/imagen";
