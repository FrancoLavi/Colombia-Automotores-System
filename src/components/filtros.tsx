"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Form de filtros por URL (GET) que se aplica solo: al cambiar un desplegable o una fecha filtra
 * en el momento, y al escribir espera a que se deje de tipear. El botón "Filtrar" queda como respaldo.
 */
export function FormFiltros({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Navegación suave: la página se actualiza sin recargar, así el campo donde se escribe no pierde el foco.
  const enviar = () => {
    if (!form.current) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form.current)) if (typeof v === "string" && v.trim()) params.append(k, v.trim());
    const qs = params.toString();
    router.replace(qs ? `${ruta}?${qs}` : ruta, { scroll: false });
  };
  return (
    <form
      ref={form}
      method="get"
      role="search"
      className={className}
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
