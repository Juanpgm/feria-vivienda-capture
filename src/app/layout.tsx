import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: "Feria de Vivienda | Registro",
  description: "Captura de datos de la Feria de Vivienda - Alcaldía de Santiago de Cali",
};

// Runs before first paint: stored choice wins, otherwise follow the OS preference (same rule as shared/tema.ts).
const themeScript = `(function(){try{var t=localStorage.getItem("tema");var d=t==="oscuro"||(t!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
