"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Form de filtros por URL (GET) que se aplica solo: al cambiar un desplegable o una fecha filtra
 * en el momento, y al escribir espera a que se deje de tipear. El botón "Filtrar" queda como respaldo.
 *
 * - `porDefecto`: valores que no cuentan como filtro (ej. estado "ACTIVOS"); no van a la URL.
 * - `plegable`: en el celular arranca cerrado detrás de un botón "Filtros", para que se vea el listado.
 * Siempre muestra cuántos filtros hay puestos y deja limpiarlos de una.
 */
export function FormFiltros({
  className,
  children,
  porDefecto = {},
  plegable = false,
  claseBarra = "",
}: {
  className?: string;
  children: React.ReactNode;
  porDefecto?: Record<string, string>;
  plegable?: boolean;
  /** Margen del botón "Filtros" y de la línea de filtros aplicados, cuando el form va dentro de una tarjeta sin padding. */
  claseBarra?: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const actuales = useSearchParams();
  const form = useRef<HTMLFormElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [abierto, setAbierto] = useState(false);

  const activos = [...actuales.entries()].filter(([k, v]) => v && porDefecto[k] !== v).length;

  // Navegación suave: la página se actualiza sin recargar, así el campo donde se escribe no pierde el foco.
  const enviar = () => {
    if (!form.current) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form.current)) if (typeof v === "string" && v.trim() && porDefecto[k] !== v.trim()) params.append(k, v.trim());
    const qs = params.toString();
    router.replace(qs ? `${ruta}?${qs}` : ruta, { scroll: false });
  };

  const limpiar = () => {
    clearTimeout(espera.current);
    // Los campos no son controlados: hay que vaciarlos a mano para que no queden mostrando el filtro viejo.
    form.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((el) => {
      const defecto = porDefecto[el.name];
      if (el instanceof HTMLSelectElement) el.value = defecto ?? (Array.from(el.options).some((o) => o.value === "") ? "" : el.options[0]?.value ?? "");
      else if (el.type !== "hidden") el.value = defecto ?? "";
    });
    router.replace(ruta, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-2">
      {plegable && (
        <button
          type="button"
          className={`btn-secundario self-start md:hidden ${claseBarra}`}
          aria-expanded={abierto}
          aria-controls="panel-filtros"
          onClick={() => setAbierto(!abierto)}
        >
          {abierto ? "Ocultar filtros" : "Filtros"}
          {activos > 0 && <span className="ml-2 rounded-full bg-acento px-2 py-0.5 text-xs text-acento-texto">{activos}</span>}
        </button>
      )}
      <form
        id={plegable ? "panel-filtros" : undefined}
        ref={form}
        method="get"
        role="search"
        className={`${className ?? ""} ${plegable && !abierto ? "max-md:hidden" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          clearTimeout(espera.current);
          enviar();
        }}
        onChange={(e) => {
          const el = e.target as unknown as HTMLInputElement;
          clearTimeout(espera.current);
          if (el.tagName === "SELECT" || el.type === "date" || el.type === "checkbox") enviar();
          else espera.current = setTimeout(enviar, 500);
        }}
      >
        {children}
      </form>
      {activos > 0 && (
        <p className={`flex flex-wrap items-center gap-x-3 text-sm text-apagado ${claseBarra}`}>
          {activos === 1 ? "1 filtro aplicado" : `${activos} filtros aplicados`}
          <button type="button" onClick={limpiar} className="min-h-11 font-semibold text-acento hover:underline">
            Limpiar filtros
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * Fila de tabla que se abre con un clic en cualquier parte. El enlace de la fila sigue siendo
 * el que se usa con teclado y lectores de pantalla; los botones y enlaces de adentro no se pisan.
 */
export function FilaEnlace({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      className={`cursor-pointer hover:bg-fondo ${className}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
        if (window.getSelection()?.toString()) return; // estaba seleccionando texto para copiar
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
