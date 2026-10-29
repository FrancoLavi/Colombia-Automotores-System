"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResultadoBusqueda } from "@/server/buscar";
import { buscarAccion } from "./buscar-actions";

type Item = { tipo: ResultadoBusqueda["tipo"] | "accion"; titulo: string; detalle: string; href: string };

const ACCIONES: Item[] = [
  { tipo: "accion", titulo: "Ingresar un auto", detalle: "Stock", href: "/stock/nuevo" },
  { tipo: "accion", titulo: "Nueva venta", detalle: "Ventas", href: "/ventas/nueva" },
  { tipo: "accion", titulo: "Cargar un contacto", detalle: "Contactos", href: "/contactos" },
  { tipo: "accion", titulo: "Registrar un movimiento de caja", detalle: "Caja", href: "/caja" },
  { tipo: "accion", titulo: "Ver el calendario de entregas", detalle: "Entregas", href: "/ventas/entregas" },
  { tipo: "accion", titulo: "Agenda", detalle: "Contactos", href: "/contactos/agenda?rango=mes" },
];

const GRUPO: Record<Item["tipo"], string> = { accion: "Accesos rápidos", auto: "Autos", contacto: "Contactos", venta: "Ventas" };
const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Buscador global: Ctrl+K (o "/") desde cualquier pantalla. Encuentra autos, contactos y ventas
 * sin tener que acordarse en qué listado están, y tiene accesos rápidos a lo que más se hace.
 */
export function Buscador() {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const idLista = useId();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(0);
  const pedido = useRef(0);

  const acciones = ACCIONES.filter((a) => !q.trim() || sinTildes(a.titulo).includes(sinTildes(q.trim())));
  const items: Item[] = [...resultados, ...acciones];

  // Atajos de teclado globales.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const escribiendo = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !escribiendo)) {
        e.preventDefault();
        setAbierto(true);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      input.current?.select();
    } else if (!abierto && d.open) d.close();
  }, [abierto]);

  // Busca 200 ms después de la última tecla; descarta respuestas viejas.
  useEffect(() => {
    const texto = q.trim();
    setActivo(0);
    if (texto.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const n = ++pedido.current;
    const t = setTimeout(async () => {
      const r = await buscarAccion(texto).catch(() => []);
      if (n !== pedido.current) return;
      setResultados(r);
      setBuscando(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const ir = (it: Item | undefined) => {
    if (!it) return;
    setAbierto(false);
    setQ("");
    router.push(it.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-nav-borde px-3 text-sm text-nav-texto hover:bg-nav-hover hover:text-white"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
          Buscar…
        </span>
        <kbd className="hidden rounded border border-nav-borde px-1.5 font-mono text-[11px] opacity-80 md:inline">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogo}
        onClose={() => setAbierto(false)}
        onClick={(e) => e.target === dialogo.current && setAbierto(false)}
        aria-label="Buscar en el sistema"
        className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-black/45"
      >
        <div className="flex items-center gap-2 border-b border-linea px-4">
          <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-apagado" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActivo((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActivo((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                ir(items[activo]);
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={idLista}
            aria-activedescendant={items.length ? `${idLista}-${activo}` : undefined}
            aria-label="Buscar autos, contactos o ventas"
            placeholder="Patente, modelo, cliente, teléfono o N° de venta"
            className="min-h-14 w-full bg-transparent text-base outline-none placeholder:text-apagado focus-visible:outline-none"
          />
          {buscando && <span className="text-xs text-apagado">Buscando…</span>}
        </div>

        <ul id={idLista} role="listbox" aria-label="Resultados" className="max-h-[55vh] overflow-y-auto p-2">
          {q.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <li className="px-3 py-3 text-sm text-apagado">No encontré autos, contactos ni ventas con &quot;{q.trim()}&quot;.</li>
          )}
          {items.map((it, i) => (
            <li key={`${it.tipo}-${it.href}-${i}`} role="presentation">
              {(i === 0 || items[i - 1].tipo !== it.tipo) && (
                <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-apagado">{GRUPO[it.tipo]}</div>
              )}
              <button
                id={`${idLista}-${i}`}
                type="button"
                role="option"
                aria-selected={i === activo}
                onMouseEnter={() => setActivo(i)}
                onClick={() => ir(it)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === activo ? "bg-info-fondo text-info-texto" : ""}`}
              >
                <span className="font-semibold">{it.titulo}</span>
                <span className="truncate text-xs text-apagado">{it.detalle}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-linea px-4 py-2 text-xs text-apagado">
          <span>
            <kbd className="font-mono">↑ ↓</kbd> moverse
          </span>
          <span>
            <kbd className="font-mono">Enter</kbd> abrir
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> cerrar
          </span>
        </div>
      </dialog>
    </>
  );
}
