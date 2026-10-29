import { beforeAll, describe, expect, it } from "vitest";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseAuto, baseContacto, INVERSOR, U } from "@/test/fabricas";
import * as veh from "./vehiculos";
import * as con from "./contactos";
import * as ven from "./ventas";
import * as caja from "./caja";

beforeAll(prepararBase);

describe("patrimonio a lo largo de una venta", () => {
  let op = 0;

  it("arranque: aporte inicial, compra y gasto", async () => {
    await caja.crearMovimiento(U, { categoria: "INGRESO_EXTRAORDINARIO", sentido: null, medio: "EFECTIVO", importe: 20_000_000, concepto: "Saldo inicial", fecha: new Date(), participeId: null });
    await caja.transferenciaInterna(U, { desde: "EFECTIVO", importe: 12_000_000, fecha: new Date(), concepto: null });
    const auto = await autoDisponible("AA111AA"); // $ 10 M pagados por banco
    await veh.agregarGasto(U, auto, { categoriaId: 1, fecha: "2026-10-02", descripcion: null, importe: 1_000_000, estado: "PAGADO", medio: "EFECTIVO" });
    const p = await caja.patrimonio();
    // K9: el Amarok lo financia un inversor, así que sus 10 M no salieron de la caja del salón.
    // De la caja solo salió 1 M de gastos, y el pase entre efectivo y banco no la cambia.
    expect(p.caja).toEqual({ efectivo: 7_000_000, banco: 12_000_000, total: 19_000_000 });
    expect(p.stock).toBe(11_000_000);
    expect(p.stockInversores).toBe(10_000_000);
    expect(p.total).toBe(30_000_000);
    // K11: del total, al salón le corresponden los 20 M que puso (19 M en caja + 1 M de gastos).
    expect(p.salon).toBe(20_000_000);
    expect(p.cajaSalon).toBe(19_000_000);

    const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Marcos", telefono: "2915550142" });
    op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_900_000, observaciones: null });
  });

  it("la permuta no duplica el patrimonio mientras la venta está abierta", async () => {
    await ven.tomarUsado(U, op, { ...baseAuto, dominio: "OPQ214", marca: "Ford", modelo: "Fiesta", anio: 2015, participeId: INVERSOR, monedaCompra: "ARS", valorCompra: 4_000_000, tcIngreso: 1_500 });
    expect((await caja.patrimonio()).stock).toBe(11_000_000);
  });

  it("al cerrar: entra la ganancia y se descuenta lo que se le debe al inversor", async () => {
    await ven.agregarPago(U, op, { tipo: "CREDITO", importe: 3_000_000, fecha: "2026-10-12", medio: "BANCO", banco: "Provincia", vence: null, cobradoAhora: false });
    await ven.agregarPago(U, op, { tipo: "TRANSFERENCIA", importe: 5_900_000, fecha: "2026-10-12", medio: "BANCO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, 1_550);
    const p = await caja.patrimonio();
    expect(p.stock).toBe(4_000_000); // ahora cuenta el Fiesta
    expect(p.aCobrar).toBe(3_000_000);
    // K10: al inversor se le deben los 10 M que puso más sus 825.000 de ganancia.
    expect(p.deudaInversores).toBe(10_825_000);
    expect(p.total).toBe(31_900_000);
    // El Fiesta entró por permuta a nombre del inversor, así que sus 4 M también son de él (K10).
    expect(p.stockInversores).toBe(4_000_000);
    // K11: 20 M iniciales + 1,9 M de ganancia − 825.000 del inversor − sus 4 M del Fiesta
    expect(p.salon).toBe(17_075_000);
  });

  it("devolverle el capital y la ganancia al inversor no cambia lo que es del salón", async () => {
    const suyo = (await caja.pendientesPorPagar()).filter((g) => g.participe.tipo === "INVERSOR");
    expect(suyo.map((g) => g.d.tipo).sort()).toEqual(["CAPITAL", "GANANCIA"]);
    for (const g of suyo) await caja.pagarDistribucion(U, g.d.id, "EFECTIVO");
    const credito = (await caja.listarCuentas({ tipo: "A_COBRAR" }))[0];
    await expect(caja.registrarPagoCuenta(U, credito.c.id, 1_000_000, "BANCO")).rejects.toThrow(/por el total/);
    await caja.registrarPagoCuenta(U, credito.c.id, 3_000_000, "BANCO");
    const p = await caja.patrimonio();
    expect(p.deudaInversores).toBe(0);
    expect(p.aCobrar).toBe(0);
    expect(p.total).toBe(21_075_000);
    // Pagada la deuda, lo único ajeno que queda es el Fiesta del inversor.
    expect(p.salon).toBe(17_075_000);
    // La devolución quedó registrada aparte del pago de la ganancia.
    const { movimientos } = await caja.movimientos({});
    expect(movimientos.find((x) => x.m.categoria === "DEVOLUCION_CAPITAL")!.m.importe).toBe(10_000_000);
    expect(movimientos.find((x) => x.m.categoria === "PAGO_INVERSOR")!.m.importe).toBe(825_000);
    expect((await ven.fichaOperacion(op))!.pagos.find((x) => x.p.tipo === "CREDITO")!.p.estado).toBe("COBRADO");
  });

  it("subcaja del inversor: lo que puso y lo que cobró", async () => {
    const inv = (await caja.subcajas()).find((x) => x.participe.tipo === "INVERSOR")!;
    // Le queda el Fiesta, que vino por permuta de su propia venta: es capital suyo al valor de toma.
    expect(inv.autos.map((a) => a.dominio)).toEqual(["OPQ214"]);
    expect(inv.capital).toBe(4_000_000);
    expect(inv.capitalPorCobrar).toBe(0);
    expect(inv.cobrado).toBe(825_000);
    expect(inv.pendiente).toBe(0);
  });
});

describe("movimientos y cuentas manuales", () => {
  it("cuenta a pagar con pago parcial", async () => {
    await caja.crearCuenta(U, { tipo: "A_PAGAR", contraparte: "Arias", importe: 1_000_000, vencimiento: null, notas: "Saldo Polo" });
    const antes = (await caja.patrimonio()).total;
    const c = (await caja.listarCuentas({ tipo: "A_PAGAR" })).find((x) => x.c.contraparte === "Arias")!;
    await caja.registrarPagoCuenta(U, c.c.id, 400_000, "EFECTIVO");
    const despues = (await caja.listarCuentas({ tipo: "A_PAGAR" })).find((x) => x.c.contraparte === "Arias")!;
    expect(despues.c.saldo).toBe(600_000);
    expect((await caja.patrimonio()).total).toBe(antes);
    await expect(caja.registrarPagoCuenta(U, c.c.id, 700_000, "EFECTIVO")).rejects.toThrow(/Supera el saldo/);
  });

  it("un gasto a pagar se marca pagado al cancelar su cuenta", async () => {
    const auto = await autoDisponible("BB222BB");
    await veh.agregarGasto(U, auto, { categoriaId: 1, fecha: "2026-10-05", descripcion: "Chapista", importe: 500_000, estado: "PENDIENTE", medio: "EFECTIVO" });
    const c = (await caja.listarCuentas({ tipo: "A_PAGAR" })).find((x) => x.c.contraparte === "Chapista")!;
    await caja.registrarPagoCuenta(U, c.c.id, 500_000, "EFECTIVO");
    const ficha = (await veh.fichaVehiculo(auto))!;
    expect(ficha.gastos[0].g.estado).toBe("PAGADO");
  });

  it("solo se anulan movimientos manuales; el pase anula sus dos patas", async () => {
    const { movimientos } = await caja.movimientos({});
    const automatico = movimientos.find((m) => m.m.categoria === "GASTO_VEHICULO")!;
    await expect(caja.anularMovimiento(U, automatico.m.id, "error")).rejects.toThrow(/otra operación/);
    const antes = await caja.movimientos({});
    const pase = antes.movimientos.find((m) => m.m.categoria === "TRANSFERENCIA_INTERNA")!;
    await caja.anularMovimiento(U, pase.m.id, "prueba");
    const despues = await caja.movimientos({});
    expect(despues.saldos.total).toBe(antes.saldos.total);
    expect(despues.movimientos.filter((m) => m.m.categoria === "TRANSFERENCIA_INTERNA" && m.m.anulado)).toHaveLength(2);
  });

  it("ajuste exige sentido; el importe tiene que ser positivo", async () => {
    await expect(caja.crearMovimiento(U, { categoria: "AJUSTE", sentido: null, medio: "EFECTIVO", importe: 10, concepto: "x", fecha: new Date(), participeId: null })).rejects.toThrow(/ingreso o egreso/);
    await expect(caja.crearMovimiento(U, { categoria: "GASTO_SALON", sentido: null, medio: "EFECTIVO", importe: 0, concepto: "x", fecha: new Date(), participeId: null })).rejects.toThrow(/mayor a cero/);
  });
});
