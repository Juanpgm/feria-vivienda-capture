import type { Requisito } from "./requisitos";

/**
 * What is ready and what is pending before a registro can be sent. The signature is expected to be pending until
 * the last step, so it is neutral (not an error) and has no "go to step" link.
 */
export function ListaRequisitos({ items, irAPaso }: { items: Requisito[]; irAPaso: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <li key={i.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-2">
          <span className={`font-semibold ${i.ok ? "text-success" : i.id === "firma" ? "text-muted" : "text-danger"}`}>{i.ok ? "Listo" : "Pendiente"}</span>
          <span>
            <span className="font-semibold">{i.titulo}:</span> {i.detalle}
            {!i.ok && i.id !== "firma" && (
              <button type="button" onClick={() => irAPaso(i.paso)} className="ml-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline underline-offset-2">
                Ir al paso
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
