import Link from "next/link";

const PESTANAS_CAJA = [
  { href: "/caja", texto: "Caja (plata líquida)" },
  { href: "/caja/cuentas", texto: "Cuentas pendientes" },
];
const PESTANAS_PATRIMONIO = [
  { href: "/patrimonio", texto: "Patrimonio" },
  { href: "/patrimonio/inversores", texto: "Inversores" },
];

export function NavCaja({ actual }: { actual: string }) {
  return <Pestanas actual={actual} pestanas={PESTANAS_CAJA} etiqueta="Secciones de caja" />;
}

export function NavPatrimonio({ actual }: { actual: string }) {
  return <Pestanas actual={actual} pestanas={PESTANAS_PATRIMONIO} etiqueta="Secciones de patrimonio" />;
}

function Pestanas({ actual, pestanas, etiqueta }: { actual: string; pestanas: { href: string; texto: string }[]; etiqueta: string }) {
  const PESTANAS = pestanas;
  return (
    <nav aria-label={etiqueta} className="flex flex-wrap gap-2.5">
      {PESTANAS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={actual === p.href ? "page" : undefined}
          className={`chip px-3.5 py-2 text-[13px] ${actual === p.href ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}
        >
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}
