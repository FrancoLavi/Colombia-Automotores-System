"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/contactos", label: "Contactos y agenda" },
  { href: "/stock", label: "Stock" },
  { href: "/ventas", label: "Ventas" },
  { href: "/caja", label: "Caja y patrimonio" },
  { href: "/auditoria", label: "Historial de cambios" },
  { href: "/configuracion", label: "Configuración" },
];

export function Nav({ nombre, salir }: { nombre: string; salir: () => Promise<void> }) {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const activo = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav aria-label="Menú principal" className="bg-tinta text-[#d6d9de] md:min-h-screen md:w-60 md:shrink-0">
      <div className="flex items-center justify-between px-5 py-4 md:block md:py-6">
        <div className="font-display text-xl font-bold text-white">
          Colombia <span className="text-[#8fa9f0]">· gestión</span>
        </div>
        <button
          type="button"
          className="btn text-white md:hidden"
          aria-expanded={abierto}
          aria-controls="menu-items"
          onClick={() => setAbierto(!abierto)}
        >
          Menú
        </button>
      </div>
      <div id="menu-items" className={`${abierto ? "block" : "hidden"} px-3 pb-4 md:block`}>
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setAbierto(false)}
            className={`block rounded-lg px-3.5 py-3 text-[15px] ${activo(i.href) ? "bg-acento text-white" : "hover:bg-[#2a3038] hover:text-white"}`}
          >
            {i.label}
          </Link>
        ))}
        <div className="mt-6 border-t border-[#2a3038] px-3.5 pt-4 text-sm">
          <div className="text-white">{nombre}</div>
          <form action={salir}>
            <button className="mt-2 min-h-11 text-[#8fa9f0] hover:text-white">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
