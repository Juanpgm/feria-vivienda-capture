// UI icons as inline SVG (no emoji or text glyphs as icons). Decorative: aria-hidden, color from currentColor,
// size from className (default 1em so they follow the text).
import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

function Icono({ className = "size-[1em]", children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`inline-block flex-none ${className}`}
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoCheck = (p: Props) => (
  <Icono strokeWidth="2.5" {...p}>
    <path d="M3 8.5l3.2 3L13 4.5" />
  </Icono>
);

export const IconoFlechaDerecha = (p: Props) => (
  <Icono {...p}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </Icono>
);

export const IconoFlechaIzquierda = (p: Props) => (
  <Icono {...p}>
    <path d="M13 8H3M7 4L3 8l4 4" />
  </Icono>
);

export const IconoChevronAbajo = (p: Props) => (
  <Icono {...p}>
    <path d="M4 6l4 4 4-4" />
  </Icono>
);

export const IconoCerrar = (p: Props) => (
  <Icono {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icono>
);

export const IconoMas = (p: Props) => (
  <Icono {...p}>
    <path d="M8 3v10M3 8h10" />
  </Icono>
);

export const IconoCamara = (p: Props) => (
  <Icono strokeWidth="1.5" {...p}>
    <path d="M2 5h2.5L6 3h4l1.5 2H14v8H2z" />
    <circle cx="8" cy="8.75" r="2.25" />
  </Icono>
);

export const IconoLapiz = (p: Props) => (
  <Icono strokeWidth="1.5" {...p}>
    <path d="M10.5 2.5l3 3L6 13H3v-3z" />
  </Icono>
);

/** Vertical ellipsis of an overflow menu (filled dots). */
export const IconoMasOpciones = (p: Props) => (
  <Icono stroke="none" fill="currentColor" {...p}>
    <circle cx="8" cy="3" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="13" r="1.5" />
  </Icono>
);
