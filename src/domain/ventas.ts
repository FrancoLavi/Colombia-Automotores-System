// Reglas de la operación de venta. Ver docs/MVP.md (S2–S7).
import { cobertura, r2, type PagoCobertura } from "./negocio";

export type EstadoOperacion = "PREVENTA" | "SENIADA" | "CERRADA" | "ENTREGADA" | "CAIDA";
export type TipoPago = PagoCobertura["tipo"];

export const ETIQUETA_OPERACION: Record<EstadoOperacion, string> = {
  PREVENTA: "Preventa",
  SENIADA: "Señada",
  CERRADA: "Cerrada",
  ENTREGADA: "Entregada",
  CAIDA: "Caída",
};

export const ETIQUETA_PAGO: Record<TipoPago, string> = {
  SENIA: "Seña",
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CREDITO: "Crédito bancario",
  PERMUTA: "Usado en parte de pago",
  OTRO: "Otro",
};

export const ABIERTAS: EstadoOperacion[] = ["PREVENTA", "SENIADA"];

/** "V-0042" */
export const numeroOperacion = (id: number) => `V-${String(id).padStart(4, "0")}`;

/** Un pago nuevo no puede hacer que lo cubierto supere el precio. */
export function validarPagoNuevo(precio: number, pagos: PagoCobertura[], importe: number): string | null {
  if (!(importe > 0)) return "El importe debe ser mayor a cero";
  const { cubierto } = cobertura(precio, pagos);
  if (r2(cubierto + importe) > r2(precio) + 0.005) return `Supera el precio: faltan cubrir solo $ ${r2(precio - cubierto).toLocaleString("es-AR")}`;
  return null;
}

/** S5: motivos que impiden cerrar (vacío = se puede cerrar). */
export function faltantesParaCerrar(
  estado: EstadoOperacion,
  precio: number,
  pagos: PagoCobertura[],
  estadoVehiculo: string,
): string[] {
  const m: string[] = [];
  if (!ABIERTAS.includes(estado)) m.push(`La operación está ${ETIQUETA_OPERACION[estado].toLowerCase()}`);
  if (estadoVehiculo !== "DISPONIBLE" && estadoVehiculo !== "RESERVADO") m.push("El auto no está disponible para vender");
  const c = cobertura(precio, pagos);
  if (!c.completo) m.push(c.faltante > 0 ? `Faltan cubrir $ ${c.faltante.toLocaleString("es-AR")}` : "Los pagos superan el precio");
  return m;
}

/** Al registrar un pago antes del cierre: ¿entra a caja ya? */
export function seCobraAlRegistrar(tipo: TipoPago, cobradoAhora: boolean): boolean {
  if (tipo === "SENIA") return true;
  if (tipo === "PERMUTA" || tipo === "CREDITO") return false;
  return cobradoAhora;
}
