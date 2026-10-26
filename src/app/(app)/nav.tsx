"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { BanderaArs, BanderaUsd } from "@/components/banderas";
import { cambiarVista } from "./vista-actions";

const ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/contactos", label: "Contactos y agenda" },
  { href: "/stock", label: "Stock" },
  { href: "/ventas", label: "Ventas" },
  { href: "/ventas/entregas", label: "Entregas" },
  { href: "/caja", label: "Caja" },
  { href: "/patrimonio", label: "Patrimonio" },
  { href: "/reportes", label: "Reportes" },
  { href: "/auditoria", label: "Historial de cambios" },
  { href: "/configuracion", label: "Configuración" },
];

/** Botón "Ver en USD / Ver en ARS": cambia cómo se muestran los importes en todas las pantallas. */
export function BotonMoneda({ enDolares, hayDolar }: { enDolares: boolean; hayDolar: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente || (!hayDolar && !enDolares)}
      onClick={() => iniciar(() => cambiarVista(!enDolares))}
      className={`btn w-full gap-1.5 border text-sm ${enDolares ? "border-celeste bg-celeste text-[#1b1f24]" : "border-nav-borde text-white hover:bg-nav-hover"}`}
      aria-pressed={enDolares}
    >
      {pendiente ? (
        "Cambiando…"
      ) : (
        <>
          Ver en {enDolares ? "ARS" : "USD"}
          {enDolares ? <BanderaArs /> : <BanderaUsd />}
        </>
      )}
    </button>
  );
}

export function Nav({ nombre, salir, enDolares, hayDolar }: { nombre: string; salir: () => Promise<void>; enDolares: boolean; hayDolar: boolean }) {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  // Gana el ítem más específico (ej. /ventas/entregas sobre /ventas).
  const elegido = ITEMS.map((i) => i.href)
    .filter((h) => (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const activo = (href: string) => href === elegido;

  return (
    // En escritorio el menú queda fijo y acompaña el scroll de la página; si no entra
    // a lo alto, scrollea por dentro. En celular sigue siendo el desplegable de arriba.
    <nav
      aria-label="Menú principal"
      className="bg-nav text-nav-texto md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:self-start md:overflow-y-auto"
    >
      <div className="flex items-center justify-between px-5 py-4 md:block md:py-6">
        <div className="font-display text-xl font-bold text-white">
          Colombia <span className="text-celeste">· gestión</span>
        </div>
        <button type="button" className="btn text-white md:hidden" aria-expanded={abierto} aria-controls="menu-items" onClick={() => setAbierto(!abierto)}>
          Menú
        </button>
      </div>
      <div id="menu-items" className={`${abierto ? "block" : "hidden"} px-3 pb-4 md:block`}>
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setAbierto(false)}
            className={`block rounded-lg px-3.5 py-3 text-[15px] ${activo(i.href) ? "bg-nav-activo text-white" : "hover:bg-nav-hover hover:text-white"}`}
          >
            {i.label}
          </Link>
        ))}
        <div className="mt-4 px-1">
          <BotonMoneda enDolares={enDolares} hayDolar={hayDolar} />
        </div>
        <div className="mt-6 border-t border-nav-hover px-3.5 pt-4 text-sm">
          <div className="text-white">{nombre}</div>
          <form action={salir}>
            <button className="mt-2 min-h-11 text-celeste hover:text-white">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
