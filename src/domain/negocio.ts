// Reglas de negocio puras (sin base de datos). Ver docs/MVP.md, sección 1.

export type TipoParticipe = "SALON" | "INVERSOR";
export type TipoIngreso = "COMPRA" | "PERMUTA" | "CONSIGNACION";

export const MARGEN_BASE = 0.15;
export const UMBRAL_MARGEN_USD = 0.1;

/** Redondea a centavos. */
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface GastoCosto {
  importe: number;
  extraordinario: boolean;
}

/** R1: costo = valor de compra (o monto pactado en consignación) + gastos no extraordinarios. */
export function costoTotal(valorCompraArs: number, gastos: GastoCosto[]): number {
  return r2(valorCompraArs + gastos.filter((g) => !g.extraordinario).reduce((s, g) => s + g.importe, 0));
}

/** R2: precio sugerido = costo × (1 + margen) + ajuste. */
export function precioSugerido(costo: number, ajuste = 0, margen = MARGEN_BASE): number {
  return r2(costo * (1 + margen) + ajuste);
}

/** V8: convierte el precio de compra cargado en USD a pesos con el TC fijado. */
export function compraEnPesos(valor: number, moneda: "ARS" | "USD", tcIngreso: number): { ars: number; usd: number } {
  if (tcIngreso <= 0) throw new Error("El tipo de cambio debe ser mayor a cero");
  return moneda === "USD" ? { ars: r2(valor * tcIngreso), usd: r2(valor) } : { ars: r2(valor), usd: r2(valor / tcIngreso) };
}

export interface Liquidacion {
  regla: "INVERSOR_BASE" | "INVERSOR_MITADES" | "SALON_TOTAL";
  costo: number;
  precio: number;
  ganancia: number;
  gananciaBase: number;
  sobreprecio: number;
  parteInversor: number;
  parteSalon: number;
}

/**
 * R3/R4: reparto de la ganancia.
 * - Financia un inversor y G ≥ 15 % de C → inversor 7,5 % de C; salón el resto (incluye sobreprecio).
 * - Financia un inversor y G < 15 % de C (incluida pérdida) → mitad y mitad.
 * - Financia el salón o es consignación → 100 % salón.
 */
export function liquidar(input: {
  costo: number;
  precio: number;
  financista: TipoParticipe;
  tipoIngreso: TipoIngreso;
  margen?: number;
}): Liquidacion {
  const margen = input.margen ?? MARGEN_BASE;
  const costo = r2(input.costo);
  const precio = r2(input.precio);
  const ganancia = r2(precio - costo);
  const gananciaBase = r2(costo * margen);
  const sobreprecio = r2(Math.max(0, ganancia - gananciaBase));

  if (input.financista === "SALON" || input.tipoIngreso === "CONSIGNACION") {
    return { regla: "SALON_TOTAL", costo, precio, ganancia, gananciaBase, sobreprecio, parteInversor: 0, parteSalon: ganancia };
  }
  if (ganancia >= gananciaBase) {
    const parteInversor = r2(gananciaBase / 2);
    return { regla: "INVERSOR_BASE", costo, precio, ganancia, gananciaBase, sobreprecio, parteInversor, parteSalon: r2(ganancia - parteInversor) };
  }
  const parteInversor = r2(ganancia / 2);
  return { regla: "INVERSOR_MITADES", costo, precio, ganancia, gananciaBase, sobreprecio, parteInversor, parteSalon: r2(ganancia - parteInversor) };
}

/**
 * R5: margen en dólares (informativo). El costo en USD usa el TC fijado al ingreso (V7);
 * el precio se convierte con el blue de hoy (o el de la venta).
 */
export function margenUsd(precio: number, costo: number, tcIngreso: number, tcActual: number) {
  const costoUsd = r2(costo / tcIngreso);
  const ventaUsd = r2(precio / tcActual);
  const margen = costoUsd > 0 ? (ventaUsd - costoUsd) / costoUsd : 0;
  return { costoUsd, ventaUsd, gananciaUsd: r2(ventaUsd - costoUsd), margen, alerta: margen <= UMBRAL_MARGEN_USD };
}

export interface PagoCobertura {
  tipo: "SENIA" | "EFECTIVO" | "TRANSFERENCIA" | "CREDITO" | "PERMUTA" | "OTRO";
  importe: number;
  estado: "PENDIENTE" | "COBRADO" | "DEVUELTA" | "RETENIDA";
}

/** S5: cuánto del precio está cubierto y cómo impacta (caja / a cobrar / stock). */
export function cobertura(precio: number, pagos: PagoCobertura[]) {
  const vigentes = pagos.filter((p) => p.estado !== "DEVUELTA" && p.estado !== "RETENIDA");
  const suma = (f: (p: PagoCobertura) => boolean) => r2(vigentes.filter(f).reduce((s, p) => s + p.importe, 0));
  const caja = suma((p) => p.tipo === "SENIA" || p.tipo === "EFECTIVO" || p.tipo === "TRANSFERENCIA" || p.tipo === "OTRO");
  const aCobrar = suma((p) => p.tipo === "CREDITO");
  const permuta = suma((p) => p.tipo === "PERMUTA");
  const cubierto = r2(caja + aCobrar + permuta);
  return { caja, aCobrar, permuta, cubierto, faltante: r2(precio - cubierto), completo: Math.abs(precio - cubierto) < 0.005 };
}

/** K3: patrimonio. */
export function patrimonio(input: { caja: number; stockAlCosto: number; aCobrar: number; aPagar: number }) {
  return r2(input.caja + input.stockAlCosto + input.aCobrar - input.aPagar);
}

/** Días en stock: desde que quedó disponible (o desde el ingreso). */
export function diasEnStock(fechaIngreso: string, fechaDisponible: string | null, hoy: Date = new Date()): number {
  const desde = new Date(`${fechaDisponible ?? fechaIngreso}T00:00:00`);
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(0, Math.round((h.getTime() - desde.getTime()) / 86_400_000));
}
