import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseAuto, baseContacto, fondear, habilitar, INVERSOR, SALON, U } from "@/test/fabricas";
import * as veh from "./vehiculos";
import * as con from "./contactos";
import * as ven from "./ventas";
import * as caja from "./caja";

beforeAll(async () => {
  await prepararBase();
  await fondear(50_000_000);
});

/** Los datos del auto tal como están, para editarlo cambiando solo lo que se pasa. */
async function datosDe(id: number, cambios: Partial<veh.DatosVehiculo> = {}): Promise<veh.DatosVehiculo> {
  const v = (await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) }))!;
  return {
    ...baseAuto,
    dominio: v.dominio,
    marca: v.marca,
    modelo: v.modelo,
    anio: v.anio,
    tipoIngreso: v.tipoIngreso,
    participeId: v.participeId,
    contactoOrigenId: v.contactoOrigenId,
    monedaCompra: v.monedaCompra,
    valorCompra: v.valorCompraArs,
    tcIngreso: v.tcIngreso,
    ...cambios,
  };
}

const movimientosDelAuto = async (id: number) =>
  (await db.select().from(s.movimientosCaja).where(eq(s.movimientosCaja.vehiculoId, id))).filter((m) => !m.anulado);

describe("cambiar quién financia un auto en stock (K15)", () => {
  it("del salón a un inversor: el inversor le devuelve al salón lo que pagó y el auto pasa a ser su capital", async () => {
    const id = await autoDisponible("FIN001", { participeId: SALON, valorCompra: 8_000_000 }, { modo: "PAGADO", medio: "BANCO" });
    const antes = await caja.patrimonio();
    await veh.actualizarVehiculo(U, id, await datosDe(id, { participeId: INVERSOR }), { modo: "PASE", medio: "BANCO" });
    const despues = await caja.patrimonio();
    const ingreso = (await movimientosDelAuto(id)).find((m) => m.sentido === "INGRESO")!;
    expect(ingreso).toMatchObject({ categoria: "PAGO_COMPRA", importe: 8_000_000, medio: "BANCO", participeId: INVERSOR });
    expect(despues.caja.banco).toBe(antes.caja.banco + 8_000_000);
    expect(despues.stockInversores).toBe(antes.stockInversores + 8_000_000);
    // Lo del salón no cambia: tenía el auto y ahora tiene la plata.
    expect(despues.salon).toBe(antes.salon);
  });

  it("de un inversor al salón: el salón le devuelve el capital, y no deja si no alcanza la plata (K13)", async () => {
    const id = await autoDisponible("FIN002", { participeId: INVERSOR, valorCompra: 70_000_000 });
    await expect(veh.actualizarVehiculo(U, id, await datosDe(id, { participeId: SALON }), { modo: "PASE", medio: "EFECTIVO" })).rejects.toThrow(/No alcanza/);
    // Nada quedó a medias: sigue siendo del inversor.
    expect((await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) }))!.participeId).toBe(INVERSOR);

    const otro = await autoDisponible("FIN003", { participeId: INVERSOR, valorCompra: 5_000_000 });
    const antes = await caja.patrimonio();
    await veh.actualizarVehiculo(U, otro, await datosDe(otro, { participeId: SALON }), { modo: "PASE", medio: "EFECTIVO" });
    const egreso = (await movimientosDelAuto(otro)).find((m) => m.sentido === "EGRESO" && m.categoria === "DEVOLUCION_CAPITAL")!;
    expect(egreso).toMatchObject({ importe: 5_000_000, medio: "EFECTIVO", participeId: INVERSOR });
    const despues = await caja.patrimonio();
    expect(despues.caja.efectivo).toBe(antes.caja.efectivo - 5_000_000);
    expect(despues.salon).toBe(antes.salon);
  });

  it("una corrección de carga cambia el dueño sin mover la caja, y queda en el historial", async () => {
    const id = await autoDisponible("FIN004", { participeId: INVERSOR, valorCompra: 6_000_000 });
    const antes = await caja.patrimonio();
    await veh.actualizarVehiculo(U, id, await datosDe(id, { participeId: SALON }), { modo: "CORRECCION" });
    const despues = await caja.patrimonio();
    expect(despues.caja).toEqual(antes.caja);
    expect(despues.salon).toBe(antes.salon + 6_000_000);
    const ficha = (await veh.fichaVehiculo(id))!;
    expect(ficha.historial[0].a.descripcion).toMatch(/corrección de carga/);
  });

  it("si el salón todavía le debía al vendedor, el inversor devuelve solo lo pagado y se queda con la deuda", async () => {
    const id = await autoDisponible("FIN005", { participeId: SALON, valorCompra: 4_000_000 }, { modo: "A_PAGAR", vencimiento: null });
    await veh.actualizarVehiculo(U, id, await datosDe(id, { participeId: INVERSOR }), { modo: "PASE", medio: "EFECTIVO" });
    // No había pagado nada: no entra plata y la cuenta a pagar se cierra (la paga el inversor, K9).
    expect((await movimientosDelAuto(id)).filter((m) => m.sentido === "INGRESO")).toHaveLength(0);
    const cuenta = (await db.select().from(s.cuentasPendientes).where(eq(s.cuentasPendientes.vehiculoId, id)))[0];
    expect(cuenta).toMatchObject({ estado: "CANCELADA", saldo: 0 });
  });

  it("un auto vendido ya no puede cambiar de financista", async () => {
    const id = await autoDisponible("FIN006", { participeId: SALON, valorCompra: 3_000_000 });
    await db.update(s.vehiculos).set({ estado: "VENDIDO" }).where(eq(s.vehiculos.id, id));
    await expect(veh.actualizarVehiculo(U, id, await datosDe(id, { participeId: INVERSOR }), { modo: "PASE", medio: "EFECTIVO" })).rejects.toThrow(/ya no está en stock/);
  });
});

describe("quién paga cada gasto del auto (R8)", () => {
  it("el gasto que paga el inversor no sale de la caja, suma a su capital y se le devuelve al vender", async () => {
    const id = await autoDisponible("GAS001", { participeId: INVERSOR, valorCompra: 10_000_000 });
    const antes = await caja.patrimonio();
    await veh.agregarGasto(U, id, { categoriaId: 1, fecha: "2026-10-03", descripcion: "Chapa", importe: 500_000, estado: "PAGADO", medio: "EFECTIVO", pagadoPor: "DUENO" });
    const despues = await caja.patrimonio();
    expect(despues.caja).toEqual(antes.caja);
    expect(despues.stockInversores).toBe(antes.stockInversores + 500_000);
    expect(despues.salon).toBe(antes.salon);
    const inv = (await caja.subcajas()).find((x) => x.participe.id === INVERSOR)!;
    expect(inv.autos.find((a) => a.id === id)).toMatchObject({ invertido: 10_500_000, gastosDelDueno: 500_000 });

    const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Ana", telefono: "2915550101" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: id, precioVenta: 12_075_000, observaciones: null });
    await ven.agregarPago(U, op, { tipo: "TRANSFERENCIA", importe: 12_075_000, fecha: "2026-10-12", medio: "BANCO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, 1_550);
    const capital = (await caja.pendientesPorPagar()).find((g) => g.participe.tipo === "INVERSOR" && g.d.tipo === "CAPITAL" && g.d.importe === 10_500_000);
    expect(capital).toBeTruthy();
  });

  it("al consignante se le debe lo pactado más los gastos que pagó él", async () => {
    const dueno = await con.crearContacto(U, { ...baseContacto, nombre: "Laura", telefono: "2915550102" });
    const id = await habilitar(
      await veh.crearVehiculo(
        U,
        { ...baseAuto, dominio: "GAS002", marca: "Citroën", modelo: "C4", anio: 2018, tipoIngreso: "CONSIGNACION", participeId: SALON, contactoOrigenId: dueno, monedaCompra: "ARS", valorCompra: 7_000_000, tcIngreso: 1_500 },
        { modo: "SIN_REGISTRO" },
      ),
    );
    await veh.agregarGasto(U, id, { categoriaId: 1, fecha: "2026-10-03", descripcion: "Service", importe: 300_000, estado: "PAGADO", medio: "EFECTIVO", pagadoPor: "DUENO" });
    expect((await movimientosDelAuto(id)).length).toBe(0);
    const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Pedro", telefono: "2915550103" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: id, precioVenta: 8_000_000, observaciones: null });
    await ven.agregarPago(U, op, { tipo: "TRANSFERENCIA", importe: 8_000_000, fecha: "2026-10-12", medio: "BANCO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, 1_550);
    const cuenta = (await db.select().from(s.cuentasPendientes).where(eq(s.cuentasPendientes.vehiculoId, id))).find((c) => c.origen === "CONSIGNANTE")!;
    expect(cuenta.importe).toBe(7_300_000);
  });

  it("un auto del salón no admite gastos pagados por otro", async () => {
    const id = await autoDisponible("GAS003", { participeId: SALON, valorCompra: 2_000_000 });
    await expect(
      veh.agregarGasto(U, id, { categoriaId: 1, fecha: "2026-10-03", descripcion: null, importe: 100_000, estado: "PAGADO", medio: "EFECTIVO", pagadoPor: "DUENO" }),
    ).rejects.toThrow(/lo paga el salón/);
  });

  it("si el auto pasa del inversor al salón, el salón le devuelve también los gastos que pagó él", async () => {
    const id = await autoDisponible("GAS004", { participeId: INVERSOR, valorCompra: 3_000_000 });
    await veh.agregarGasto(U, id, { categoriaId: 1, fecha: "2026-10-03", descripcion: null, importe: 200_000, estado: "PAGADO", medio: "EFECTIVO", pagadoPor: "DUENO" });
    await veh.actualizarVehiculo(U, id, await datosDe(id, { participeId: SALON }), { modo: "PASE", medio: "BANCO" });
    expect((await movimientosDelAuto(id)).find((m) => m.categoria === "DEVOLUCION_CAPITAL")!.importe).toBe(3_200_000);
    const gastos = await db.select().from(s.gastos).where(eq(s.gastos.vehiculoId, id));
    expect(gastos.every((g) => g.pagadoPor === "SALON")).toBe(true);
  });
});
