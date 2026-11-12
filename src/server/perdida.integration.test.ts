import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseContacto, fondear, INVERSOR, SALON, U } from "@/test/fabricas";
import * as veh from "./vehiculos";
import * as con from "./contactos";
import * as ven from "./ventas";
import * as caja from "./caja";

beforeAll(async () => {
  await prepararBase();
  await fondear(50_000_000);
});

let telefono = 2915550200;
/** Vende el auto por ese precio, cobrado por transferencia, y cierra la venta. */
async function vender(vehiculoId: number, precio: number) {
  const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Cliente", telefono: String(telefono++) });
  const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId, precioVenta: precio, observaciones: null });
  await ven.agregarPago(U, op, { tipo: "TRANSFERENCIA", importe: precio, fecha: "2026-11-05", medio: "BANCO", banco: null, vence: null, cobradoAhora: true });
  await ven.cerrarOperacion(U, op, 1_550);
  const liq = (await db.query.liquidaciones.findFirst({ where: eq(s.liquidaciones.operacionId, op) }))!;
  return { op, liq };
}

const pendientesDe = async (liquidacionId: number) =>
  db.select().from(s.distribuciones).where(and(eq(s.distribuciones.liquidacionId, liquidacionId), eq(s.distribuciones.participeId, INVERSOR)));

describe("venta con pérdida de un auto de inversor (R3, K10)", () => {
  it("se le devuelve el capital menos su mitad de la pérdida, en un solo pago", async () => {
    // Puso 10 M; el salón le puso 1 M de gastos (costo 11 M). Se vende a 9,6 M: pérdida de 1,4 M, 700.000 para cada uno.
    const id = await autoDisponible("PER001", { participeId: INVERSOR, valorCompra: 10_000_000 });
    await veh.agregarGasto(U, id, { categoriaId: 1, fecha: "2026-11-02", descripcion: null, importe: 1_000_000, estado: "PAGADO", medio: "BANCO" });
    const { op, liq } = await vender(id, 9_600_000);
    expect(liq.parteInversor).toBe(-700_000);
    expect(liq.parteSalon).toBe(-700_000);

    const antes = await caja.patrimonio();
    expect(antes.deudaInversores).toBe(9_300_000);
    const [mov, ...otros] = await caja.liquidarAlInversor(U, liq.id, INVERSOR, "BANCO");
    expect(otros).toHaveLength(0);
    const m = (await db.query.movimientosCaja.findFirst({ where: eq(s.movimientosCaja.id, mov) }))!;
    expect(m).toMatchObject({ sentido: "EGRESO", categoria: "DEVOLUCION_CAPITAL", importe: 9_300_000, operacionId: op });
    expect(m.concepto).toMatch(/menos su parte de la pérdida/);
    // Las dos partes quedan saldadas con ese único pago.
    expect((await pendientesDe(liq.id)).every((d) => d.estado === "PAGADO" && d.movimientoId === mov)).toBe(true);
    const despues = await caja.patrimonio();
    expect(despues.deudaInversores).toBe(0);
    expect(despues.caja.banco).toBe(antes.caja.banco - 9_300_000);
    expect(despues.salon).toBe(antes.salon);
  });

  it("si su parte de la pérdida supera lo que puso, devuelve la diferencia y entra a la caja", async () => {
    // Puso 1 M; el salón le puso 3 M de gastos (costo 4 M). Se vende a 1 M: pérdida de 3 M, 1,5 M para él.
    const id = await autoDisponible("PER002", { participeId: INVERSOR, valorCompra: 1_000_000 });
    await veh.agregarGasto(U, id, { categoriaId: 1, fecha: "2026-11-02", descripcion: null, importe: 3_000_000, estado: "PAGADO", medio: "BANCO" });
    const { liq } = await vender(id, 1_000_000);
    expect(liq.parteInversor).toBe(-1_500_000);

    const antes = await caja.patrimonio();
    const [mov] = await caja.liquidarAlInversor(U, liq.id, INVERSOR, "EFECTIVO");
    const m = (await db.query.movimientosCaja.findFirst({ where: eq(s.movimientosCaja.id, mov) }))!;
    expect(m).toMatchObject({ sentido: "INGRESO", categoria: "REINTEGRO_INVERSOR", importe: 500_000, medio: "EFECTIVO" });
    const despues = await caja.patrimonio();
    expect(despues.caja.efectivo).toBe(antes.caja.efectivo + 500_000);
    expect(despues.salon).toBe(antes.salon);

    // El reintegro no se corrige como un ajuste a mano: anularlo lo deja pendiente otra vez, no se pierde.
    await expect(caja.editarMovimiento(U, mov, { medio: "BANCO", importe: 1, concepto: "x", fecha: new Date(), personaId: null })).rejects.toThrow(/otra operación/);
    await caja.anularMovimiento(U, mov, "Lo trajo en transferencia");
    expect((await pendientesDe(liq.id)).every((d) => d.estado === "PENDIENTE" && d.movimientoId === null)).toBe(true);
    expect((await caja.patrimonio()).salon).toBe(antes.salon);
    await caja.liquidarAlInversor(U, liq.id, INVERSOR, "BANCO");
    expect((await pendientesDe(liq.id)).every((d) => d.estado === "PAGADO")).toBe(true);
  });

  it("con ganancia siguen siendo dos movimientos: capital y ganancia", async () => {
    const id = await autoDisponible("PER003", { participeId: INVERSOR, valorCompra: 10_000_000 });
    const { liq } = await vender(id, 12_000_000);
    const movs = await caja.liquidarAlInversor(U, liq.id, INVERSOR, "BANCO");
    const cats = (await db.select().from(s.movimientosCaja)).filter((m) => movs.includes(m.id)).map((m) => [m.categoria, m.importe]);
    expect(cats).toEqual([
      ["DEVOLUCION_CAPITAL", 10_000_000],
      ["PAGO_INVERSOR", 750_000],
    ]);
  });
});

describe("deshacer un cobro o pago de Cuentas pendientes", () => {
  it("un pago parcial anulado vuelve a dejar la cuenta con su saldo", async () => {
    await caja.crearCuenta(U, { tipo: "A_PAGAR", contraparte: "Chapista", importe: 250_000, vencimiento: null, notas: null });
    const cuenta = (await caja.listarCuentas({ tipo: "A_PAGAR" })).find((c) => c.c.contraparte === "Chapista")!;
    const mov = await caja.registrarPagoCuenta(U, cuenta.c.id, 100_000, "EFECTIVO");
    expect((await db.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, cuenta.c.id) }))!.saldo).toBe(150_000);
    await caja.anularMovimiento(U, mov, "Era por banco");
    expect((await db.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, cuenta.c.id) }))!).toMatchObject({ saldo: 250_000, estado: "ABIERTA" });
  });

  it("un gasto pagado desde Cuentas pendientes se puede borrar después de anular el pago", async () => {
    const id = await autoDisponible("PER004", { participeId: SALON, valorCompra: 2_000_000 });
    await veh.agregarGasto(U, id, { categoriaId: 1, fecha: "2026-11-02", descripcion: "Chapa", importe: 300_000, estado: "PENDIENTE", medio: "EFECTIVO" });
    const gasto = (await db.select().from(s.gastos).where(eq(s.gastos.vehiculoId, id)))[0];
    // Sin proveedor cargado, la cuenta no usa el detalle como si fuera una persona.
    const cuenta = (await db.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, gasto.cuentaPendienteId!) }))!;
    expect(cuenta.contraparte).toMatch(/^Proveedor de /);
    expect(cuenta.notas).toMatch(/\(Chapa\)$/);
    const mov = await caja.registrarPagoCuenta(U, gasto.cuentaPendienteId!, 300_000, "EFECTIVO");
    await expect(veh.eliminarGasto(U, id, gasto.id)).rejects.toThrow(/pagos/);
    // La ficha del movimiento ofrece anularlo (antes mandaba de vuelta al auto).
    expect((await caja.fichaMovimiento(mov))!.deshacer).toBe("CUENTA");
    await caja.anularMovimiento(U, mov, "Mal cargado");
    expect((await db.query.gastos.findFirst({ where: eq(s.gastos.id, gasto.id) }))!).toMatchObject({ estado: "PENDIENTE", movimientoId: null });
    await veh.eliminarGasto(U, id, gasto.id);
    expect(await db.select().from(s.gastos).where(eq(s.gastos.vehiculoId, id))).toHaveLength(0);
  });
});
