import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import * as veh from "./vehiculos";
import * as con from "./contactos";
import * as ven from "./ventas";

const U = 1; // usuario de prueba
const SALON = 1;
const INVERSOR = 2;
const base = {
  chasis: null, version: "Highline", km: 50_000, color: "Gris", combustible: null, transmision: null,
  ingresadoPor: null, contactoOrigenId: null, fechaIngreso: "2026-10-01", ubicacion: "SALON" as const, observaciones: null,
};
const contacto = {
  apellido: "Pérez", dniCuit: null, email: null, localidad: null, origen: "WHATSAPP" as const, calificacionMonto: null,
  calificacionBanco: null, productoInteres: null, usadoAEntregar: null, observaciones: null, proximoContacto: null,
};

async function autoDisponible(dominio: string, d: Partial<veh.DatosVehiculo> = {}) {
  const id = await veh.crearVehiculo(
    U,
    { ...base, dominio, marca: "Volkswagen", modelo: "Amarok", anio: 2019, tipoIngreso: "COMPRA", participeId: INVERSOR, monedaCompra: "ARS", valorCompra: 10_000_000, tcIngreso: 1_500, ...d },
    { modo: "PAGADO", medio: "BANCO" },
  );
  const docs = await db.select().from(s.documentosVehiculo).where(eq(s.documentosVehiculo.vehiculoId, id));
  for (const doc of docs) await veh.registrarDocumento(U, id, doc.id, "RECIBIDO", null);
  await veh.guardarPeritaje(U, id, { fecha: "2026-10-02", perito: null, resultado: "APTO", reparacionEstimada: null, observaciones: null });
  await veh.habilitarVenta(U, id);
  return id;
}

const saldoCaja = async () =>
  (await db.select().from(s.movimientosCaja)).filter((m) => !m.anulado).reduce((a, m) => a + (m.sentido === "INGRESO" ? m.importe : -m.importe), 0);

beforeAll(prepararBase);

describe("venta completa: seña + permuta + crédito + efectivo", () => {
  let auto = 0;
  let op = 0;
  let cliente = 0;

  it("arma la preventa y reserva el auto con la seña", async () => {
    auto = await autoDisponible("AA111AA");
    await veh.agregarGasto(U, auto, { categoriaId: 1, fecha: "2026-10-02", descripcion: null, importe: 1_000_000, estado: "PAGADO", medio: "EFECTIVO" });
    cliente = await con.crearContacto(U, { ...contacto, nombre: "Marcos", telefono: "2915550142" });
    op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_900_000, observaciones: null });
    expect((await con.fichaContacto(cliente))!.c.etapa).toBe("PREVENTA");

    await ven.agregarPago(U, op, { tipo: "SENIA", importe: 300_000, fecha: "2026-10-10", medio: "EFECTIVO", banco: null, vence: "2026-10-16", cobradoAhora: true });
    const f = (await ven.fichaOperacion(op))!;
    expect(f.op.estado).toBe("SENIADA");
    expect(f.v.estado).toBe("RESERVADO");
  });

  it("toma el usado (no pasa por caja) y registra el crédito", async () => {
    const antes = await saldoCaja();
    const usado = await ven.tomarUsado(U, op, { ...base, dominio: "OPQ214", marca: "Ford", modelo: "Fiesta", anio: 2015, participeId: INVERSOR, monedaCompra: "ARS", valorCompra: 4_000_000, tcIngreso: 1_500 });
    await ven.agregarPago(U, op, { tipo: "CREDITO", importe: 3_000_000, fecha: "2026-10-12", medio: "BANCO", banco: "Provincia", vence: null, cobradoAhora: false });
    expect(await saldoCaja()).toBe(antes);
    const v = await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, usado) });
    expect(v).toMatchObject({ tipoIngreso: "PERMUTA", estado: "POR_INGRESAR", contactoOrigenId: cliente, operacionOrigenId: op });
  });

  it("no cierra incompleta ni acepta pagos de más", async () => {
    await expect(ven.cerrarOperacion(U, op, 1_550)).rejects.toThrow(/Faltan cubrir \$ 5\.600\.000/);
    await expect(
      ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 9_000_000, fecha: "2026-10-12", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true }),
    ).rejects.toThrow(/Supera el precio/);
  });

  it("cierra: liquida 7,5 % inversor + resto salón y deja el crédito a cobrar", async () => {
    await ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 5_600_000, fecha: "2026-10-12", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, 1_550);
    const f = (await ven.fichaOperacion(op))!;
    expect(f.op.estado).toBe("CERRADA");
    expect(f.v.estado).toBe("VENDIDO");
    expect(f.contacto.etapa).toBe("CLIENTE");
    expect(f.liquidacion).toMatchObject({ regla: "INVERSOR_BASE", costo: 11_000_000, ganancia: 1_900_000, parteInversor: 825_000, parteSalon: 1_075_000, costoUsd: 7_333.33 });
    expect(f.distribuciones.map((d) => d.d.importe).sort()).toEqual([1_075_000, 825_000]);
    const ctas = await db.select().from(s.cuentasPendientes).where(eq(s.cuentasPendientes.operacionId, op));
    expect(ctas).toHaveLength(1);
    expect(ctas[0]).toMatchObject({ tipo: "A_COBRAR", origen: "CREDITO_BANCARIO", saldo: 3_000_000 });
  });

  it("cobra el crédito, entrega y un gasto posterior queda como extraordinario", async () => {
    const antes = await saldoCaja();
    const credito = (await ven.fichaOperacion(op))!.pagos.find((x) => x.p.tipo === "CREDITO")!;
    await ven.cobrarPagoPendiente(U, op, credito.p.id, "BANCO");
    expect(await saldoCaja()).toBe(antes + 3_000_000);
    const historial = (await ven.fichaOperacion(op))!.historial.map((h) => h.a.descripcion);
    expect(historial).toContain("Cobrado: crédito bancario $ 3.000.000");
    await ven.entregarOperacion(U, op, new Date("2026-10-15T16:00:00"));
    await veh.agregarGasto(U, auto, { categoriaId: 1, fecha: "2026-10-20", descripcion: "Multa vieja", importe: 50_000, estado: "PAGADO", medio: "EFECTIVO" });
    const f = (await ven.fichaOperacion(op))!;
    expect(f.op.estado).toBe("ENTREGADA");
    expect(f.v.estado).toBe("ENTREGADO");
    expect(f.liquidacion!.ganancia).toBe(1_900_000); // la liquidación quedó congelada
    const gastos = await db.select().from(s.gastos).where(eq(s.gastos.vehiculoId, auto));
    expect(gastos.find((g) => g.descripcion === "Multa vieja")!.extraordinario).toBe(true);
  });
});

describe("operación caída y consignación", () => {
  it("al caer devuelve la seña, libera el auto y da de baja la permuta", async () => {
    const auto = await autoDisponible("CC333CC");
    const cliente = await con.crearContacto(U, { ...contacto, nombre: "Ana", telefono: "2914440000" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_000_000, observaciones: null });
    await ven.agregarPago(U, op, { tipo: "SENIA", importe: 200_000, fecha: "2026-10-13", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    const usado = await ven.tomarUsado(U, op, { ...base, dominio: "ZZ999ZZ", marca: "Fiat", modelo: "Palio", anio: 2012, participeId: INVERSOR, monedaCompra: "ARS", valorCompra: 3_000_000, tcIngreso: 1_500 });
    const antes = await saldoCaja();
    await ven.caerOperacion(U, op, "No le aprobaron el crédito", "DEVOLVER", "EFECTIVO");
    const f = (await ven.fichaOperacion(op))!;
    expect(f.op.estado).toBe("CAIDA");
    expect(f.v.estado).toBe("DISPONIBLE");
    expect(f.contacto.etapa).toBe("DATO");
    expect(await saldoCaja()).toBe(antes - 200_000);
    expect((await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, usado) }))!.estado).toBe("BAJA");
  });

  it("seña retenida: queda en caja", async () => {
    const auto = await autoDisponible("DD444DD");
    const cliente = await con.crearContacto(U, { ...contacto, nombre: "Luis", telefono: "2914441111" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_000_000, observaciones: null });
    await ven.agregarPago(U, op, { tipo: "SENIA", importe: 100_000, fecha: "2026-10-13", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    const antes = await saldoCaja();
    await ven.caerOperacion(U, op, "Desistió", "RETENER", "EFECTIVO");
    expect(await saldoCaja()).toBe(antes);
    expect((await ven.fichaOperacion(op))!.pagos[0].p.estado).toBe("RETENIDA");
  });

  it("consignación: 100 % salón y deuda con el dueño por lo pactado", async () => {
    const duenio = await con.crearContacto(U, { ...contacto, nombre: "Dueño", telefono: "2914442222" });
    const auto = await autoDisponible("EE555EE", { tipoIngreso: "CONSIGNACION", valorCompra: 8_000_000, contactoOrigenId: duenio });
    const cliente = await con.crearContacto(U, { ...contacto, nombre: "Comprador", telefono: "2914443333" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 9_000_000, observaciones: null });
    await ven.agregarPago(U, op, { tipo: "TRANSFERENCIA", importe: 9_000_000, fecha: "2026-10-14", medio: "BANCO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, null);
    const f = (await ven.fichaOperacion(op))!;
    expect(f.financista!.id).toBe(SALON);
    expect(f.liquidacion).toMatchObject({ regla: "SALON_TOTAL", ganancia: 1_000_000, parteSalon: 1_000_000, parteInversor: 0 });
    const deuda = await db.select().from(s.cuentasPendientes).where(eq(s.cuentasPendientes.operacionId, op));
    expect(deuda).toEqual([expect.objectContaining({ tipo: "A_PAGAR", origen: "CONSIGNANTE", contraparte: "Dueño Pérez", saldo: 8_000_000 })]);
  });

  it("no se puede vender un auto que no está disponible", async () => {
    const cliente = await con.crearContacto(U, { ...contacto, nombre: "Otro", telefono: "2914444444" });
    const vendido = (await db.select().from(s.vehiculos).where(eq(s.vehiculos.dominio, "AA111AA")))[0];
    await expect(ven.crearOperacion(U, { contactoId: cliente, vehiculoId: vendido.id, precioVenta: 1, observaciones: null })).rejects.toThrow(/no está disponible/);
  });
});
