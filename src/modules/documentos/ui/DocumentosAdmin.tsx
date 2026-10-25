import { ETIQUETA_ADJUNTO, TIPOS_FOTO } from "../domain/imagen";

/** Admin-only block of the registro detail (the page only renders it for admin/superadmin; the API enforces it too). */
export function DocumentosAdmin({ registroId }: { registroId: string }) {
  return (
    <section aria-labelledby="det-documentos">
      <h2 id="det-documentos" className="mb-2 border-b border-border pb-1 text-lg font-bold text-primary-strong">
        Documento de identidad
      </h2>
      <p className="mb-3 text-sm text-muted">Se abre en una pestaña nueva. Cada vez que se abre una foto queda un registro de acceso.</p>
      <div className="flex flex-wrap gap-2">
        {TIPOS_FOTO.map((tipo) => (
          <a
            key={tipo}
            href={`/api/registros/${encodeURIComponent(registroId)}/adjuntos/${tipo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-border bg-bg px-4 font-semibold hover:bg-surface"
          >
            Ver documento: {tipo === "documento_frente" ? "frente" : "reverso"}
            <span className="sr-only"> ({ETIQUETA_ADJUNTO[tipo]}, se abre en una pestaña nueva)</span>
          </a>
        ))}
      </div>
    </section>
  );
}
