"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { Resultado } from "@/lib/form";
import { Dialogo } from "./dialogo";
import { ETIQUETA_ESTADO, type EstadoVehiculo, type Severidad } from "@/domain/stock";

const COLOR_ESTADO: Record<EstadoVehiculo, string> = {
  POR_INGRESAR: "bg-aviso-fondo text-aviso-texto",
  DISPONIBLE: "bg-ok-fondo text-ok-texto",
  RESERVADO: "bg-info-fondo text-info-texto",
  VENDIDO: "bg-neutro-fondo text-neutro-texto",
  ENTREGADO: "bg-invertido text-invertido-texto",
  RECHAZADO: "bg-error-fondo text-error-texto",
  BAJA: "bg-neutro-fondo text-neutro-texto",
};

export function ChipEstado({ estado }: { estado: EstadoVehiculo }) {
  return <span className={`chip ${COLOR_ESTADO[estado]}`}>{ETIQUETA_ESTADO[estado].toUpperCase()}</span>;
}

const COLOR_SEVERIDAD: Record<Severidad, string> = {
  CRITICA: "bg-aviso-texto text-white",
  AVISO: "bg-aviso-fondo text-aviso-texto",
  INFO: "bg-neutro-fondo text-neutro-texto",
};

export function ChipAlerta({ severidad, children }: { severidad: Severidad; children: React.ReactNode }) {
  return <span className={`chip ${COLOR_SEVERIDAD[severidad]}`}>{children}</span>;
}

export function Mensaje({ r }: { r: Resultado }) {
  if (r.error)
    return (
      <p role="alert" className="rounded-lg bg-aviso-fondo px-3 py-2 text-sm text-aviso-texto">
        {r.error}
      </p>
    );
  if (r.ok && r.mensaje)
    return (
      <p role="status" className="rounded-lg bg-ok-fondo px-3 py-2 text-sm text-ok-texto">
        {r.mensaje}
      </p>
    );
  return null;
}

export function BotonEnviar({ children, className = "btn-primario", pendiente = "Guardando…" }: { children: React.ReactNode; className?: string; pendiente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? pendiente : children}
    </button>
  );
}

/**
 * Botón para sacar algo (un pago, un gasto, una foto). Muestra el verbo al lado de la cruz:
 * con la cruz sola nadie sabe qué hace hasta que la toca.
 * `soloIcono` es para cuando va encima de otra cosa y no hay lugar, como en las fotos.
 */
export function BotonQuitar({ etiqueta, accion, soloIcono = false }: { etiqueta: string; accion: () => Promise<Resultado>; soloIcono?: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  const verbo = etiqueta.split(" ")[0]; // "Quitar pago" → "Quitar", "Eliminar gasto" → "Eliminar"
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={etiqueta}
        title={etiqueta}
        disabled={pendiente}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg text-apagado hover:bg-aviso-fondo hover:text-aviso-texto ${soloIcono ? "min-w-11 justify-center" : "px-2.5 text-sm"}`}
        onClick={() => setAbierto(true)}
      >
        <span aria-hidden="true">✕</span>
        {pendiente ? "…" : !soloIcono && verbo}
      </button>
      <Dialogo
        abierto={abierto}
        titulo={`¿${etiqueta}?`}
        confirmar={verbo}
        peligro
        onCerrar={() => setAbierto(false)}
        onConfirmar={() =>
          iniciar(async () => {
            const r = await accion();
            setError(r.error ?? "");
          })
        }
      >
        Queda registrado en el historial de cambios.
      </Dialogo>
      {error && <span className="text-xs text-aviso-texto">{error}</span>}
    </span>
  );
}

/**
 * Explicación corta de un término del negocio ("ganancia base", "margen USD"…), al lado del término.
 * Se abre al pasar el mouse, al enfocar con teclado o al tocarlo en el celular.
 */
export function Ayuda({ children, etiqueta = "Qué es esto" }: { children: React.ReactNode; etiqueta?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <span className="group relative inline-flex align-middle" onMouseLeave={() => setAbierta(false)}>
      <button
        type="button"
        aria-label={etiqueta}
        aria-expanded={abierta}
        onClick={() => setAbierta(!abierta)}
        onBlur={() => setAbierta(false)}
        className="ml-1 inline-flex size-5 items-center justify-center rounded-full border border-campo-borde text-[11px] font-bold leading-none text-apagado hover:border-acento hover:text-acento"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`${abierta ? "block" : "hidden"} absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg bg-invertido px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-invertido-texto shadow-lg group-hover:block`}
      >
        {children}
      </span>
    </span>
  );
}
