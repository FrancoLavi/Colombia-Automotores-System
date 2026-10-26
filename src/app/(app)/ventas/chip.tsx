import { ETIQUETA_OPERACION, type EstadoOperacion } from "@/domain/ventas";

const COLOR: Record<EstadoOperacion, string> = {
  PREVENTA: "bg-neutro-fondo text-neutro-texto",
  SENIADA: "bg-info-fondo text-info-texto",
  CERRADA: "bg-ok-fondo text-ok-texto",
  ENTREGADA: "bg-invertido text-invertido-texto",
  CAIDA: "bg-error-fondo text-error-texto",
};

export function ChipOperacion({ estado }: { estado: EstadoOperacion }) {
  return <span className={`chip ${COLOR[estado]}`}>{ETIQUETA_OPERACION[estado].toUpperCase()}</span>;
}
