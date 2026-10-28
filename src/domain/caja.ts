// Reglas de caja y patrimonio. Ver docs/MVP.md (K1–K11).
import { patrimonio, r2, type TipoIngreso, type TipoParticipe } from "./negocio";

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
  DEVOLUCION_CAPITAL: "Devolución de capital",
  APORTE: "Aporte de capital",
  INGRESO_EXTRAORDINARIO: "Ingreso extraordinario",
  PAGO_CUENTA: "Pago de cuenta",
  COBRO_CUENTA: "Cobro de cuenta",
  TRANSFERENCIA_INTERNA: "Pase entre efectivo y banco",
  AJUSTE: "Ajuste",
  SUELDO: "Sueldo",
};

/** Movimientos que se cargan a mano desde Caja (el resto los generan stock, ventas y cuentas). */
export const MANUALES = {
  SUELDO: "EGRESO",
  GASTO_SALON: "EGRESO",
  GASTO_EXTRAORDINARIO: "EGRESO",
  RETIRO_SOCIO: "EGRESO",
  APORTE: "INGRESO",
  INGRESO_EXTRAORDINARIO: "INGRESO",
  AJUSTE: null, // ingreso o egreso
} as const satisfies Record<string, Sentido | null>;
export type CategoriaManual = keyof typeof MANUALES;

export const esManual = (categoria: string) => categoria in MANUALES || categoria === "TRANSFERENCIA_INTERNA";

/** Movimientos que se atribuyen a un socio o empleado: el sueldo la exige; retiros y aportes la admiten. */
export const PIDEN_PERSONA = ["SUELDO", "RETIRO_SOCIO", "APORTE"] as const;
export const exigePersona = (categoria: string) => categoria === "SUELDO";

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

// ---------- La plata de los inversores (K9–K11) ----------

/**
 * K9: la compra de un auto que financia un inversor la paga el inversor directo al vendedor,
 * así que no sale de la caja del salón ni le queda como deuda.
 * Los gastos del auto (R1) sí los pone el salón, y los recupera al vender: el capital que se
 * le devuelve al inversor es solo lo que puso él (K10).
 */
export function compraSaleDeCaja(a: { tipoIngreso: TipoIngreso; financista: TipoParticipe }): boolean {
  return a.tipoIngreso === "COMPRA" && a.financista === "SALON";
}

export interface PiezasPatrimonio {
  /** Toda la plata que hay: efectivo + banco, sea de quien sea. */
  caja: number;
  /** Todo el stock propio, al costo (compra + gastos). */
  stock: number;
  /** De ese stock, lo que pusieron los inversores: el valor de compra de sus autos, sin gastos. */
  capitalInversores: number;
  aCobrar: number;
  aPagar: number;
  /** Capital y ganancias de ventas ya cerradas que todavía no se les pagaron a los inversores. */
  deudaInversores: number;
}

/** K3: patrimonio total = todo lo que hay, sea del salón o de los inversores. */
export function patrimonioTotal(p: PiezasPatrimonio): number {
  return patrimonio({ caja: p.caja, stockAlCosto: p.stock, aCobrar: p.aCobrar, aPagar: p.aPagar });
}

/** K11: del total, lo que es del salón: se le descuenta todo lo que es de los inversores. */
export function patrimonioSalon(p: PiezasPatrimonio): number {
  return r2(patrimonioTotal(p) - p.capitalInversores - p.deudaInversores);
}

/**
 * K11: la caja del salón. La caja guarda plata que no es suya: lo que se les debe a los
 * inversores por autos ya vendidos. Mientras el auto está en stock su capital no se descuenta
 * de la caja, porque no está en la caja: está en el auto.
 */
export function cajaDelSalon(cajaTotal: number, deudaInversores: number): number {
  return r2(cajaTotal - deudaInversores);
}
