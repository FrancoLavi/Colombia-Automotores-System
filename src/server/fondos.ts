import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { schema as s, type Tx } from "@/db";
import { faltaDeFondos, saldos, type Fondos } from "@/domain/caja";
import { r2 } from "@/domain/negocio";
import { ErrorNegocio } from "./errores";

/**
 * Cómo está la plata dentro de la transacción: efectivo, banco y lo que de la caja es ajeno
 * (K11): lo que se les debe a los inversores y a los consignantes por autos ya vendidos.
 */
export async function fotoFondos(t: Tx): Promise<Fondos> {
  const movs = await t.select({ sentido: s.movimientosCaja.sentido, medio: s.movimientosCaja.medio, importe: s.movimientosCaja.importe, anulado: s.movimientosCaja.anulado }).from(s.movimientosCaja);
  const [inv] = await t
    .select({ total: sql<number>`coalesce(sum(${s.distribuciones.importe}), 0)::float` })
    .from(s.distribuciones)
    .innerJoin(s.participes, eq(s.participes.id, s.distribuciones.participeId))
    .where(and(eq(s.distribuciones.estado, "PENDIENTE"), eq(s.participes.tipo, "INVERSOR")));
  const [con] = await t
    .select({ total: sql<number>`coalesce(sum(${s.cuentasPendientes.saldo}), 0)::float` })
    .from(s.cuentasPendientes)
    .where(and(eq(s.cuentasPendientes.estado, "ABIERTA"), eq(s.cuentasPendientes.origen, "CONSIGNANTE")));
  const { efectivo, banco } = saldos(movs);
  return { efectivo, banco, ajena: r2(inv.total + con.total) };
}

/**
 * K13: se llama al final de toda transacción que saca plata de la caja (o anula un ingreso), con
 * la foto que se sacó al principio. Si la operación deja en negativo el efectivo, el banco o la
 * caja del salón, se cancela todo.
 */
export async function exigirFondos(t: Tx, antes: Fondos, opciones: { anulando?: boolean } = {}) {
  const error = faltaDeFondos(antes, await fotoFondos(t), undefined, opciones.anulando);
  if (error) throw new ErrorNegocio(error);
}
