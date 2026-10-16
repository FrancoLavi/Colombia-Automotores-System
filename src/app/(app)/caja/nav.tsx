import Link from "next/link";

const PESTANAS = [
  { href: "/caja", texto: "Caja y patrimonio" },
  { href: "/caja/cuentas", texto: "Cuentas pendientes" },
  { href: "/caja/inversores", texto: "Inversores" },
];

export function NavCaja({ actual }: { actual: string }) {
  return (
    <nav aria-label="Secciones de caja" className="flex flex-wrap gap-2.5">
      {PESTANAS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={actual === p.href ? "page" : undefined}
          className={`chip px-3.5 py-2 text-[13px] ${actual === p.href ? "bg-tinta text-white" : "border border-borde bg-white text-tinta"}`}
        >
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}
