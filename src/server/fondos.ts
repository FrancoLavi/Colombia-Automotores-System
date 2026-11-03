import "server-only";
import { schema as s, type Tx } from "@/db";
import { faltaDeFondos, saldos } from "@/domain/caja";
import { ErrorNegocio } from "./errores";

/**
 * K13: se llama al final de toda transacción que saca plata de la caja (o anula un ingreso).
 * Si con ese cambio el efectivo o el banco quedan en negativo, se cancela todo.
 */
export async function exigirFondos(t: Tx) {
  const movs = await t.select({ sentido: s.movimientosCaja.sentido, medio: s.movimientosCaja.medio, importe: s.movimientosCaja.importe, anulado: s.movimientosCaja.anulado }).from(s.movimientosCaja);
  const error = faltaDeFondos(saldos(movs));
  if (error) throw new ErrorNegocio(error);
}
