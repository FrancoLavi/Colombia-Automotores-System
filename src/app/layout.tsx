import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { temaActual } from "@/lib/tema";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["500", "600", "700"] });
const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Colombia Automotores · Gestión",
  description: "Gestión de stock, ventas, caja y patrimonio",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // El tema se resuelve en el servidor para que la página ya llegue pintada y no pegue un flash blanco.
  const tema = await temaActual();
  return (
    <html lang="es" data-tema={tema}>
      <body className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
