import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { temaActual } from "@/lib/tema";
import "./globals.css";

/**
 * Las fuentes se sirven desde el repo (./fonts), no desde `next/font/google`.
 *
 * Con next/font/google, cada build sale a bajarlas de Google. El 11/11/2026 Google cambió el
 * formato de las URL de IBM Plex Sans —pasó de un archivo `.woff2` a `/l/font?kit=…`, sin
 * extensión— y el cargador de Next se rompió contra su propia expresión regular:
 *
 *     const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];   // exec() → null
 *
 * Eso dejó de compilar TODO deploy, no solo uno. Teniendo los archivos acá, el build no sale a
 * internet y no hay nada de afuera que lo pueda romper.
 *
 * Son los subsets `latin` que servía Google (alcanzan para el español: acentos y ñ entran en
 * Latin-1). Las tres familias son licencia SIL Open Font, que permite redistribuirlas.
 * Para actualizarlas: bajar de fonts.googleapis.com el bloque `/* latin *\/` de cada peso.
 */
const archivo = localFont({
  variable: "--font-archivo",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  src: [
    { path: "./fonts/archivo-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/archivo-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/archivo-700.woff2", weight: "700", style: "normal" },
  ],
});
const plexSans = localFont({
  variable: "--font-plex-sans",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  src: [
    { path: "./fonts/plex-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plex-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plex-sans-600.woff2", weight: "600", style: "normal" },
  ],
});
const plexMono = localFont({
  variable: "--font-plex-mono",
  display: "swap",
  fallback: ["ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
  src: [
    { path: "./fonts/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
});

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
