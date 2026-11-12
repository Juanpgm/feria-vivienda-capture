import type { TipoFoto } from "../domain/imagen";

export const PASO_FOTO: Record<TipoFoto, { numero: 1 | 2; titulo: string; ayuda: string }> = {
  documento_frente: { numero: 1, titulo: "Parte de adelante", ayuda: "El lado donde sale su foto y su nombre." },
  documento_reverso: { numero: 2, titulo: "Parte de atrás", ayuda: "El lado contrario: sin su foto, con el código de barras o la huella." },
};

/** Simple drawing of the card side to photograph (not the real document): face + lines for the front, code for the back. */
export function IlustracionCedula({ lado, className = "" }: { lado: TipoFoto; className?: string }) {
  return (
    <svg viewBox="0 0 160 101" role="img" aria-label={lado === "documento_frente" ? "Dibujo del frente de la cédula: foto a la izquierda y datos a la derecha" : "Dibujo del reverso de la cédula: código de barras"} className={className}>
      <rect x="1" y="1" width="158" height="99" rx="9" className="fill-surface stroke-primary" strokeWidth="2" />
      {lado === "documento_frente" ? (
        <>
          <rect x="12" y="24" width="46" height="58" rx="4" className="fill-border" />
          <circle cx="35" cy="45" r="9" className="fill-muted" />
          <path d="M18 82c2-14 10-19 17-19s15 5 17 19z" className="fill-muted" />
          <rect x="68" y="26" width="72" height="6" rx="3" className="fill-muted" />
          <rect x="68" y="40" width="58" height="6" rx="3" className="fill-muted" />
          <rect x="68" y="54" width="66" height="6" rx="3" className="fill-muted" />
          <rect x="68" y="68" width="40" height="6" rx="3" className="fill-muted" />
          <rect x="12" y="9" width="90" height="6" rx="3" className="fill-primary" />
        </>
      ) : (
        <>
          {Array.from({ length: 28 }, (_, i) => (
            <rect key={i} x={14 + i * 4.3} y="52" width={i % 3 === 0 ? 3 : 1.6} height="34" className="fill-muted" />
          ))}
          <rect x="14" y="14" width="44" height="28" rx="4" className="fill-border" />
          <rect x="68" y="16" width="76" height="6" rx="3" className="fill-muted" />
          <rect x="68" y="30" width="60" height="6" rx="3" className="fill-muted" />
        </>
      )}
    </svg>
  );
}
