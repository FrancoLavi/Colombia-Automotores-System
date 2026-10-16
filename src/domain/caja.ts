// Reglas de caja y patrimonio. Ver docs/MVP.md (K1–K6).
import { r2 } from "./negocio";

export type Medio = "EFECTIVO" | "BANCO";
export type Sentido = "INGRESO" | "EGRESO";

export const ETIQUETA_CATEGORIA: Record<string, string> = {
  COBRO_VENTA: "Cobro de venta",
  SENIA: "Seña",
  DEVOLUCION_SENIA: "Devolución",
  COBRO_CREDITO: "Cobro de crédito",
  PAGO_COMPRA: "Pago de compra",
  PAGO_CONSIGNANTE: "Pago a consignante",
  GASTO_VEHICULO: "Gasto de auto",
  GASTO_SALON: "Gasto del salón",
  GASTO_EXTRAORDINARIO: "Gasto extraordinario",
  RETIRO_SOCIO: "Retiro de ganancia",
  PAGO_INVERSOR: "Pago a inversor",
  APORTE: "Aporte de capital",
  INGRESO_EXTRAORDINARIO: "Ingreso extraordinario",
  PAGO_CUENTA: "Pago de cuenta",
  COBRO_CUENTA: "Cobro de cuenta",
  TRANSFERENCIA_INTERNA: "Pase entre efectivo y banco",
  AJUSTE: "Ajuste",
};

/** Movimientos que se cargan a mano desde Caja (el resto los generan stock, ventas y cuentas). */
export const MANUALES = {
  GASTO_SALON: "EGRESO",
  GASTO_EXTRAORDINARIO: "EGRESO",
  RETIRO_SOCIO: "EGRESO",
  APORTE: "INGRESO",
  INGRESO_EXTRAORDINARIO: "INGRESO",
  AJUSTE: null, // ingreso o egreso
} as const satisfies Record<string, Sentido | null>;
export type CategoriaManual = keyof typeof MANUALES;

export const esManual = (categoria: string) => categoria in MANUALES || categoria === "TRANSFERENCIA_INTERNA";

export interface MovimientoSaldo {
  sentido: Sentido;
  medio: Medio;
  importe: number;
  anulado: boolean;
}

/** K1: saldo de caja por medio (los anulados no cuentan). */
export function saldos(movs: MovimientoSaldo[]) {
  const s = { EFECTIVO: 0, BANCO: 0 };
  for (const m of movs) if (!m.anulado) s[m.medio] += m.sentido === "INGRESO" ? m.importe : -m.importe;
  return { efectivo: r2(s.EFECTIVO), banco: r2(s.BANCO), total: r2(s.EFECTIVO + s.BANCO) };
}

export interface AutoPatrimonio {
  estado: string;
  tipoIngreso: "COMPRA" | "PERMUTA" | "CONSIGNACION";
  costo: number;
  /** Estado de la venta que originó la permuta (si vino por permuta). */
  estadoOperacionOrigen: string | null;
}

/**
 * K3: ¿el auto suma al patrimonio?
 * - Solo autos en stock (por ingresar, disponible, reservado).
 * - Los consignados no son del salón.
 * - Una permuta cuenta recién cuando se cierra la venta que la trajo (antes sería doble conteo).
 */
export function cuentaEnPatrimonio(a: AutoPatrimonio): boolean {
  if (!["POR_INGRESAR", "DISPONIBLE", "RESERVADO"].includes(a.estado)) return false;
  if (a.tipoIngreso === "CONSIGNACION") return false;
  if (a.tipoIngreso === "PERMUTA" && a.estadoOperacionOrigen && !["CERRADA", "ENTREGADA"].includes(a.estadoOperacionOrigen)) return false;
  return true;
}

export function valorStock(autos: AutoPatrimonio[]) {
  return r2(autos.filter(cuentaEnPatrimonio).reduce((s, a) => s + a.costo, 0));
}
