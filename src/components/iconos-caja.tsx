// Íconos de línea para Caja: cada tipo de movimiento tiene el suyo, así se reconoce de un vistazo.
// Decorativos (aria-hidden): el texto de al lado siempre dice lo mismo.

const TRAZOS = {
  venta: "M3 10.5V4a1 1 0 0 1 1-1h6.5L17 9.5 10.5 16 3 10.5Z M7 7h.01",
  auto: "M3 13v-3l2-4h10l2 4v3H3Z M3 13v2h2v-2 M15 13v2h2v-2 M6 10.5h.01 M14 10.5h.01",
  salon: "M3 8l1.5-4h11L17 8 M3 8h14 M4 8v8h12V8 M8 16v-4h4v4",
  persona: "M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M4 17a6 6 0 0 1 12 0",
  retiro: "M10 12V3 M6 7l4-4 4 4 M4 13v3h12v-3",
  ingreso: "M10 3v9 M6 8l4 4 4-4 M4 13v3h12v-3",
  inversor: "M4 6a6 2 0 1 0 12 0a6 2 0 1 0-12 0 M4 6v4c0 1.1 2.7 2 6 2s6-.9 6-2V6 M4 10v4c0 1.1 2.7 2 6 2s6-.9 6-2v-4",
  pase: "M4 7h11 M12 4l3 3-3 3 M16 13H5 M8 10l-3 3 3 3",
  ajuste: "M10 3v14 M6 17h8 M4 6h12 M4 6l-2 5a2 2 0 0 0 4 0L4 6 M16 6l-2 5a2 2 0 0 0 4 0l-2-5",
  cuenta: "M6 3h6l4 4v10H6V3Z M12 3v4h4 M8 11h6 M8 14h4",
  banco: "M3 8l7-4 7 4 M4 8h12 M5 8v6 M8.5 8v6 M11.5 8v6 M15 8v6 M3 16.5h14",
  efectivo: "M2 6h16v9H2Z M10 8.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M5 8.5h.01 M15 12.5h.01",
  total: "M3 7l7-3 7 3-7 3-7-3Z M3 11l7 3 7-3 M3 15l7 3 7-3",
  candado: "M5 9h10v8H5Z M7 9V6a3 3 0 0 1 6 0v3 M10 12.5v1.5",
  lapiz: "M4 16l1-4 8-8 3 3-8 8-4 1Z M12 5l3 3",
  anular: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M5 15L15 5",
  flecha: "M4 10h12 M12 6l4 4-4 4",
} as const;
export type NombreIcono = keyof typeof TRAZOS;

/** Tipo de movimiento → ícono. */
export const ICONO_CATEGORIA: Record<string, NombreIcono> = {
  COBRO_VENTA: "venta",
  SENIA: "venta",
  DEVOLUCION_SENIA: "venta",
  COBRO_CREDITO: "cuenta",
  PAGO_COMPRA: "auto",
  PAGO_CONSIGNANTE: "auto",
  GASTO_VEHICULO: "auto",
  GASTO_SALON: "salon",
  GASTO_EXTRAORDINARIO: "salon",
  RETIRO_SOCIO: "retiro",
  PAGO_INVERSOR: "inversor",
  DEVOLUCION_CAPITAL: "inversor",
  APORTE: "ingreso",
  INGRESO_EXTRAORDINARIO: "ingreso",
  PAGO_CUENTA: "cuenta",
  COBRO_CUENTA: "cuenta",
  TRANSFERENCIA_INTERNA: "pase",
  AJUSTE: "ajuste",
  SUELDO: "persona",
};

export function Icono({ nombre, className = "size-5" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}

/** Círculo con el ícono del tipo: verde si entró plata, naranja si salió, gris si está anulado. */
export function InsigniaMovimiento({ categoria, sentido, anulado = false, grande = false }: { categoria: string; sentido?: "INGRESO" | "EGRESO"; anulado?: boolean; grande?: boolean }) {
  const color = anulado ? "bg-fondo text-apagado" : sentido === "INGRESO" ? "bg-ok-fondo text-ok-texto" : sentido === "EGRESO" ? "bg-aviso-fondo text-aviso-texto" : "bg-info-fondo text-info-texto";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${color} ${grande ? "size-12" : "size-8"}`}>
      <Icono nombre={ICONO_CATEGORIA[categoria] ?? "total"} className={grande ? "size-6" : "size-4"} />
    </span>
  );
}
