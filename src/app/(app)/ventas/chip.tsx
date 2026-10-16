import { ETIQUETA_OPERACION, type EstadoOperacion } from "@/domain/ventas";

const COLOR: Record<EstadoOperacion, string> = {
  PREVENTA: "bg-neutro-fondo text-neutro-texto",
  SENIADA: "bg-info-fondo text-info-texto",
  CERRADA: "bg-ok-fondo text-ok-texto",
  ENTREGADA: "bg-tinta text-white",
  CAIDA: "bg-[#f3d6d6] text-[#7a1f1f]",
};

export function ChipOperacion({ estado }: { estado: EstadoOperacion }) {
  return <span className={`chip ${COLOR[estado]}`}>{ETIQUETA_OPERACION[estado].toUpperCase()}</span>;
}
