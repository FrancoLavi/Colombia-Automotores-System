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
/** Un movimiento cargado a mano se puede corregir; un pase entre medios no (son dos movimientos): se anula y se carga de nuevo. */
export const esEditable = (categoria: string) => categoria in MANUALES;

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

/** Cómo está la plata: por medio y lo que de toda la caja es del salón (K11). */
export interface Fondos {
  efectivo: number;
  banco: number;
  /** Plata de la caja que es de inversores y consignantes por autos ya vendidos. */
  ajena: number;
}

const pesosAR = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

/**
 * K13: no puede salir plata que no hay. Compara cómo estaba la caja antes de la operación y cómo
 * queda: frena si el efectivo, el banco o la caja del salón (caja − lo ajeno, K11) quedan en
 * negativo **por culpa de esta operación**. Si ya venían en negativo (datos viejos), no frena lo
 * que no los empeora, como pagarle a un inversor lo que se le debe.
 * Devuelve el error para mostrar, o null si se puede.
 */
export function faltaDeFondos(antes: Fondos, despues: Fondos, moneda: (n: number) => string = pesosAR): string | null {
  const empeora = (a: number, d: number) => d < 0 && d < a - 0.005;
  if (empeora(antes.efectivo, despues.efectivo)) {
    return `No alcanza el efectivo: hay ${moneda(Math.max(0, antes.efectivo))} y faltarían ${moneda(-despues.efectivo)}. Si la plata sale del banco, elegí Banco o registrá primero la extracción (pase Banco → Efectivo).`;
  }
  if (empeora(antes.banco, despues.banco)) {
    return `No alcanza la plata del banco: hay ${moneda(Math.max(0, antes.banco))} y faltarían ${moneda(-despues.banco)}. Si la plata sale del efectivo, elegí Efectivo o registrá primero el depósito (pase Efectivo → Banco).`;
  }
  const salonAntes = r2(antes.efectivo + antes.banco - antes.ajena);
  const salonDespues = r2(despues.efectivo + despues.banco - despues.ajena);
  if (empeora(salonAntes, salonDespues)) {
    const medio = despues.efectivo < antes.efectivo ? "el efectivo" : despues.banco < antes.banco ? "el banco" : "la caja";
    return `No alcanza la plata del salón en ${medio}: de la caja, ${moneda(antes.ajena)} son de inversores o consignantes por autos vendidos y al salón le quedan ${moneda(Math.max(0, salonAntes))}. Faltarían ${moneda(-salonDespues)}. Primero hay que cobrar lo pendiente o que los socios pongan plata (Aporte).`;
  }
  return null;
}

/**
 * K14: con qué medio conviene pagar un egreso. El formulario lo deja preseleccionado; el que
 * paga siempre puede cambiarlo.
 *
 * Por defecto efectivo, que es como opera el salón. Pero si el efectivo no alcanza y el banco sí,
 * sugiere el banco: desde K13 pagar de donde no hay ni siquiera se puede, así que sin esto el que
 * paga se come un rechazo y tiene que adivinar con qué medio reintentar.
 *
 * Mira solo los dos medios. La caja del salón (K11) no depende del medio que se elija: si lo que
 * falta es esa, K13 frena igual y elegir banco no ayuda.
 *
 * Un importe negativo es un reintegro: entra plata, no hay nada que cubrir.
 */
export function medioSugerido(saldos: { efectivo: number; banco: number }, importe: number): Medio {
  if (importe <= 0) return "EFECTIVO";
  if (saldos.efectivo >= importe) return "EFECTIVO";
  if (saldos.banco >= importe) return "BANCO";
  // No alcanza en ninguno: el menos malo, para que el rojo quede donde ya estaba.
  return saldos.banco > saldos.efectivo ? "BANCO" : "EFECTIVO";
}

/**
 * Para seguir de dónde sale un saldo: los movimientos en orden, cada uno con cómo queda el saldo
 * después de él. Los anulados se muestran pero no lo mueven. El último saldo es el de la tarjeta.
 */
export function conSaldoAcumulado<T extends MovimientoSaldo>(movs: T[]): (T & { saldo: number })[] {
  let saldo = 0;
  return movs.map((m) => {
    if (!m.anulado) saldo = r2(saldo + (m.sentido === "INGRESO" ? m.importe : -m.importe));
    return { ...m, saldo };
  });
}

export interface FiltroDetalle {
  desde?: Date;
  hasta?: Date;
  categoria?: string;
  /** Busca en el concepto, sin importar mayúsculas ni acentos. */
  q?: string;
  /** Rango de importe, en pesos. */
  min?: number;
  max?: number;
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Filtra los movimientos del detalle de un saldo. Se aplica después de acumular, así el saldo de cada fila sigue siendo el real. */
export function filtrarDetalle<T extends MovimientoSaldo & { fecha: Date; categoria: string; concepto: string }>(movs: T[], f: FiltroDetalle): T[] {
  const q = f.q?.trim() ? sinAcentos(f.q.trim()) : null;
  return movs.filter(
    (m) =>
      (!f.desde || m.fecha >= f.desde) &&
      (!f.hasta || m.fecha <= f.hasta) &&
      (!f.categoria || m.categoria === f.categoria) &&
      (!q || sinAcentos(m.concepto).includes(q)) &&
      (f.min == null || m.importe >= f.min) &&
      (f.max == null || m.importe <= f.max),
  );
}

/** Cuánto entró y salió por cada tipo de movimiento (sin anulados), de mayor a menor peso. */
export function resumenPorCategoria(movs: (MovimientoSaldo & { categoria: string })[]) {
  const porCategoria = new Map<string, { categoria: string; ingresos: number; egresos: number; cantidad: number }>();
  for (const m of movs) {
    if (m.anulado) continue;
    const c = porCategoria.get(m.categoria) ?? { categoria: m.categoria, ingresos: 0, egresos: 0, cantidad: 0 };
    if (m.sentido === "INGRESO") c.ingresos = r2(c.ingresos + m.importe);
    else c.egresos = r2(c.egresos + m.importe);
    c.cantidad++;
    porCategoria.set(m.categoria, c);
  }
  return [...porCategoria.values()]
    .map((c) => ({ ...c, neto: r2(c.ingresos - c.egresos) }))
    .sort((a, b) => Math.abs(b.neto) - Math.abs(a.neto));
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

/**
 * K10: lo que es del inversor en un auto suyo, y que hay que devolverle al venderlo: el valor
 * de compra, sin los gastos (esos los pone el salón, R1).
 *
 * Cuenta igual si el auto entró por permuta. El usado que se toma en parte de pago de un auto
 * del inversor se le acredita a él al valor de toma: es plata suya que volvía de esa venta y
 * quedó puesta en otro auto, no una compra del salón. Si el usado fuera del salón, al cargarlo
 * se le pone al salón como financista y no cuenta acá.
 *
 * La consignación no cuenta: ese auto no es de nadie del salón (K3).
 */
export function capitalDelInversor(a: { tipoIngreso: TipoIngreso; financista: TipoParticipe; valorCompraArs: number; gastosDelDueno?: number }): number {
  return a.tipoIngreso !== "CONSIGNACION" && a.financista === "INVERSOR" ? r2(a.valorCompraArs + (a.gastosDelDueno ?? 0)) : 0;
}

// ---------- Quién paga cada gasto del auto (R8) ----------

/** R8: un gasto del auto lo paga el salón (sale de su caja) o el dueño del auto: el inversor que lo financia o el consignante. */
export type PagadorGasto = "SALON" | "DUENO";

/**
 * R8: lo que el dueño del auto puso en gastos de su bolsillo (sin los extraordinarios, que son
 * siempre del salón, R6). No pasa por la caja del salón y se le devuelve al vender, junto con lo
 * que puso en la compra (K10) o lo pactado (S7).
 */
export function gastosDelDueno(gastos: { importe: number; extraordinario: boolean; pagadoPor: PagadorGasto }[]): number {
  return r2(gastos.filter((g) => g.pagadoPor === "DUENO" && !g.extraordinario).reduce((s, g) => s + g.importe, 0));
}

/** S7 + R8: lo que se le debe al dueño de un auto en consignación al venderlo. */
export function deudaConConsignante(pactado: number, gastosDelDueno: number): number {
  return r2(pactado + gastosDelDueno);
}

// ---------- Cambio de quién financia un auto en stock (K15) ----------

export interface CambioFinancista {
  de: TipoParticipe;
  a: TipoParticipe;
  /**
   * Lo que tenía puesto el que financiaba hasta ahora: si era el salón, el valor de compra menos
   * lo que todavía le debe al vendedor; si era un inversor, su capital (K10, con sus gastos, R8).
   */
  puesto: number;
  /** El auto entró por permuta y la venta que lo trajo sigue abierta: el cierre lo resuelve (K12). */
  permutaPendiente: boolean;
  /** Se corrige un error de carga: nadie le pagó a nadie. */
  correccion: boolean;
}

/**
 * K15: al cambiar quién financia un auto en stock, el nuevo dueño le devuelve al anterior lo que
 * había puesto, y eso se ve en la caja del salón:
 * - Del salón a un inversor: el inversor le devuelve al salón lo que pagó → **ingreso**.
 * - De un inversor al salón: el salón le devuelve al inversor su capital → **egreso** (K13).
 * - Entre inversores: se pagan entre ellos, la caja no se entera.
 * Si es una corrección de un error de carga, o una permuta cuya venta sigue abierta, no se mueve nada.
 */
export function efectoCambioFinancista(c: CambioFinancista): { sentido: "INGRESO" | "EGRESO"; importe: number } | null {
  if (c.correccion || c.permutaPendiente || c.de === c.a) return null;
  const importe = r2(c.puesto);
  if (importe <= 0) return null;
  return { sentido: c.de === "SALON" ? "INGRESO" : "EGRESO", importe };
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

// ---------- Balance del salón en un período (HU-8.1) ----------

export interface PiezasBalance {
  /** Patrimonio del salón al empezar el período (K11). */
  inicio: number;
  /** Patrimonio del salón al terminar el período (o hoy, si no terminó). */
  fin: number;
  /** Parte del salón en las ventas cerradas en el período (R3). */
  ganancia: number;
  /** Gastos del salón y extraordinarios. */
  gastos: number;
  /** Sueldos de empleados (los de los socios van con los retiros). */
  sueldosEmpleados: number;
  /** Lo que se llevaron los socios: retiros y sueldos de socios. */
  retirosSocios: number;
  /** Lo que pusieron los socios: aportes e ingresos extraordinarios. */
  aportes: number;
}

/**
 * La foto del salón al empezar y al terminar el período, y qué pasó en el medio.
 * El **resultado** es lo que generó el período antes de que los socios decidan qué hacer con eso:
 * fin − inicio + lo que se llevaron − lo que pusieron. "Otros" es lo que no se explica con lo
 * anterior (señas cobradas de ventas todavía abiertas, ajustes): así la cuenta siempre cierra.
 */
export function balanceDelSalon(p: PiezasBalance) {
  const resultado = r2(p.fin - p.inicio + p.retirosSocios - p.aportes);
  const otros = r2(resultado - (p.ganancia - p.gastos - p.sueldosEmpleados));
  return { ...p, resultado, otros };
}
