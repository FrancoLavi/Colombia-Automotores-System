"use client";

import { useFormStatus } from "react-dom";
import type { Resultado } from "@/lib/form";
import { ETIQUETA_ESTADO, type EstadoVehiculo, type Severidad } from "@/domain/stock";

const COLOR_ESTADO: Record<EstadoVehiculo, string> = {
  POR_INGRESAR: "bg-aviso-fondo text-aviso-texto",
  DISPONIBLE: "bg-ok-fondo text-ok-texto",
  RESERVADO: "bg-info-fondo text-info-texto",
  VENDIDO: "bg-neutro-fondo text-neutro-texto",
  ENTREGADO: "bg-tinta text-white",
  RECHAZADO: "bg-[#f3d6d6] text-[#7a1f1f]",
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
