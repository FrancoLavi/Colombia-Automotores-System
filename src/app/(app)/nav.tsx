"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { BanderaArs, BanderaUsd } from "@/components/banderas";
import { cambiarVista } from "./vista-actions";
import { Buscador } from "./buscador";

// Trazos de 20×20 para los íconos del menú: ayudan a reconocer cada sección de un vistazo.
const ICONO = {
  inicio: "M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z",
  contactos: "M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8c0-3 2.2-5 5-5s5 2 5 5M14 4.5a2.5 2.5 0 0 1 0 5M15 12c2 .5 3 2.2 3 5",
  stock: "M2 13v-2.5L4 7h12l2 3.5V13H2Zm2 0v2m12-2v2M5.5 13a1.5 1.5 0 1 0 0 .01M14.5 13a1.5 1.5 0 1 0 0 .01",
  ventas: "M10.5 2.5H17v6.5l-8 8-6.5-6.5zM13.5 6.5h.01",
  entregas: "M3 5h14v12H3zM3 8.5h14M7 3v4M13 3v4M6.5 12h3",
  caja: "M2 6h16v9H2zM10 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5 8.5v2M15 8.5v2",
  patrimonio: "M10 3v7h7a7 7 0 1 1-7-7Zm2.5-.5A7 7 0 0 1 17.5 7.5H12.5z",
  reportes: "M3 17h14M5 14V9M9 14V5M13 14v-3M17 14V7",
  historial: "M10 17a7 7 0 1 0-7-7M3 6v4h4M10 6.5V10l2.5 2",
  configuracion: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8",
} as const;

// Agrupado por lo que se está haciendo: vender, manejar la plata, administrar.
const GRUPOS: { titulo: string | null; items: { href: string; label: string; icono: keyof typeof ICONO }[] }[] = [
  { titulo: null, items: [{ href: "/", label: "Inicio", icono: "inicio" }] },
  {
    titulo: "Comercial",
    items: [
      { href: "/contactos", label: "Contactos y agenda", icono: "contactos" },
      { href: "/stock", label: "Stock", icono: "stock" },
      { href: "/ventas", label: "Ventas", icono: "ventas" },
      { href: "/ventas/entregas", label: "Entregas", icono: "entregas" },
    ],
  },
  {
    titulo: "Plata",
    items: [
      { href: "/caja", label: "Caja", icono: "caja" },
      { href: "/patrimonio", label: "Patrimonio", icono: "patrimonio" },
      { href: "/reportes", label: "Reportes", icono: "reportes" },
    ],
  },
  {
    titulo: "Sistema",
    items: [
      { href: "/auditoria", label: "Historial de cambios", icono: "historial" },
      { href: "/configuracion", label: "Configuración", icono: "configuracion" },
    ],
  },
];
const ITEMS = GRUPOS.flatMap((g) => g.items);

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
      <div className="px-3 pb-3 md:pb-4">
        <Buscador />
      </div>
      <div id="menu-items" className={`${abierto ? "block" : "hidden"} px-3 pb-4 md:block`}>
        {GRUPOS.map((g) => (
          <div key={g.titulo ?? "inicio"} className={g.titulo ? "mt-3" : ""}>
            {g.titulo && <div className="px-3.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-nav-texto/60">{g.titulo}</div>}
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setAbierto(false)}
                aria-current={activo(i.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] ${activo(i.href) ? "bg-nav-activo text-white" : "hover:bg-nav-hover hover:text-white"}`}
              >
                <svg viewBox="0 0 20 20" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={ICONO[i.icono]} />
                </svg>
                {i.label}
              </Link>
            ))}
          </div>
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
