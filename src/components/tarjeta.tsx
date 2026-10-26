import Link from "next/link";

/**
 * Tarjeta de resumen que lleva a otra pantalla. Se puede hacer click en toda su
 * superficie, no solo en el texto del pie.
 *
 * Solo sirve para tarjetas que no tengan adentro otros links, botones o campos:
 * anidar interactivos dentro de un link rompe el HTML y deja inservibles los de adentro.
 */
export function TarjetaEnlace({
  href,
  pie,
  className = "",
  children,
}: {
  href: string;
  pie: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`tarjeta flex flex-col text-tinta no-underline transition-colors hover:border-acento hover:bg-fondo ${className}`}>
      {children}
      <span className="mt-auto pt-0.5 text-sm font-semibold text-acento">{pie} →</span>
    </Link>
  );
}
