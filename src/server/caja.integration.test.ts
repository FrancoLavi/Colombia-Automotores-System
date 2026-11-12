import { beforeAll, describe, expect, it } from "vitest";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseAuto, baseContacto, fondear, INVERSOR, U } from "@/test/fabricas";
import * as veh from "./vehiculos";
import * as con from "./contactos";
import * as ven from "./ventas";
import * as caja from "./caja";
import { generarComprobante } from "./comprobante-pdf";

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
    // K10/K12: de los 10 M que puso, 4 M se los llevó en el Fiesta: en plata se le deben 6 M,
    // más sus 825.000 de ganancia.
    expect(p.deudaInversores).toBe(6_825_000);
    expect(p.total).toBe(31_900_000);
    // El Fiesta entró por permuta a nombre del inversor, así que sus 4 M también son de él (K10).
    expect(p.stockInversores).toBe(4_000_000);
    // K11: al salón le quedan sus 20 M iniciales más su parte de la ganancia, y nada más.
    // El Fiesta y los 6 M que faltan devolverle son del inversor, cada cosa contada una sola vez.
    expect(p.salon).toBe(21_075_000);
    // Caja del salón + lo suyo en autos + a cobrar − a pagar = patrimonio del salón.
    const c = p.conciliacion;
    expect(Math.round(c.cajaSalon + c.autos + c.aCobrar - c.aPagar)).toBe(p.salon);
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
    expect(p.total).toBe(25_075_000);
    // Pagada la deuda, lo único ajeno que queda es el Fiesta del inversor.
    expect(p.salon).toBe(21_075_000);
    // La devolución quedó registrada aparte del pago de la ganancia, y por los 6 M en plata (K12).
    const { movimientos } = await caja.movimientos({});
    expect(movimientos.find((x) => x.m.categoria === "DEVOLUCION_CAPITAL")!.m.importe).toBe(6_000_000);
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
  beforeAll(() => fondear());

  it("cuenta a pagar con pago parcial", async () => {
    await caja.crearCuenta(U, { tipo: "A_PAGAR", contraparte: "Arias", importe: 1_000_000, vencimiento: null, notas: "Saldo Polo" });
    const antes = (await caja.patrimonio()).total;
    const c = (await caja.listarCuentas({ tipo: "A_PAGAR" })).find((x) => x.c.contraparte === "Arias")!;
    const movimiento = await caja.registrarPagoCuenta(U, c.c.id, 400_000, "EFECTIVO");
    // HU-5.10: el pago tiene su comprobante en PDF.
    const comp = (await generarComprobante(movimiento, "Prueba"))!;
    expect(comp.nombre).toBe(`C-${String(movimiento).padStart(6, "0")}.pdf`);
    expect(Buffer.from(comp.pdf).subarray(0, 4).toString()).toBe("%PDF");
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
    const automatico = movimientos.find((m) => m.m.categoria === "GASTO_VEHICULO" && !m.m.cuentaPendienteId)!;
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

describe("detalle de saldos y ficha de cada movimiento", () => {
  it("el detalle va de lo más nuevo a lo más viejo, filtra sin cambiar el saldo de cada fila y cierra con la tarjeta", async () => {
    const d = await caja.detalleSaldo("EFECTIVO");
    const p = await caja.patrimonio();
    expect(d.movimientos[0].saldo).toBe(p.caja.efectivo);
    const fechas = d.movimientos.map((x) => x.fecha.getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    const soloGastos = await caja.detalleSaldo("EFECTIVO", { categoria: "GASTO_VEHICULO" });
    expect(soloGastos.movimientos.every((x) => x.categoria === "GASTO_VEHICULO")).toBe(true);
    for (const x of soloGastos.movimientos) expect(x.saldo).toBe(d.movimientos.find((y) => y.id === x.id)!.saldo);
  });

  it("lleva al trámite que lo generó y solo deja corregir lo cargado a mano", async () => {
    const { movimientos } = await caja.detalleSaldo();
    const gasto = movimientos.find((x) => x.categoria === "GASTO_VEHICULO" && !x.anulado)!;
    const f = (await caja.fichaMovimiento(gasto.id))!;
    expect(f.origen?.href).toMatch(/^\/stock\/\d+#gastos$/);
    expect(f.editable).toBe(false);
    await expect(caja.editarMovimiento(U, gasto.id, { medio: "EFECTIVO", importe: 1, concepto: "x", fecha: new Date(), personaId: null })).rejects.toThrow(/desde su origen/);

    await caja.transferenciaInterna(U, { desde: "BANCO", importe: 1_000, fecha: new Date(), concepto: null });
    const pase = (await caja.detalleSaldo(undefined, { categoria: "TRANSFERENCIA_INTERNA" })).movimientos.find((x) => !x.anulado)!;
    await expect(caja.editarMovimiento(U, pase.id, { medio: "EFECTIVO", importe: 1, concepto: "x", fecha: new Date(), personaId: null })).rejects.toThrow(/anulalo/);

    const inicial = movimientos.find((x) => x.concepto === "Saldo inicial")!;
    expect((await caja.fichaMovimiento(inicial.id))!.origen).toBeNull();
    const antes = (await caja.patrimonio()).caja.efectivo;
    await caja.editarMovimiento(U, inicial.id, { medio: "EFECTIVO", importe: inicial.importe + 500_000, concepto: "Saldo inicial corregido", fecha: inicial.fecha, personaId: null });
    expect((await caja.patrimonio()).caja.efectivo).toBe(antes + 500_000);
    expect((await caja.fichaMovimiento(inicial.id))!.concepto).toBe("Saldo inicial corregido");
  });
});

describe("la caja nunca queda en negativo (K13)", () => {
  it("no deja sacar más efectivo del que hay, pero sí con un pase previo desde el banco", async () => {
    const { saldos } = await caja.movimientos({});
    const mov = (importe: number) => caja.crearMovimiento(U, { categoria: "GASTO_SALON", sentido: null, medio: "EFECTIVO", importe, concepto: "Gasto grande", fecha: new Date(), participeId: null });
    await expect(mov(saldos.efectivo + 1)).rejects.toThrow(/No alcanza el efectivo/);
    expect((await caja.movimientos({})).saldos).toEqual(saldos); // no quedó nada a medias
    await caja.transferenciaInterna(U, { desde: "BANCO", importe: 1, fecha: new Date(), concepto: null });
    await mov(saldos.efectivo + 1);
    expect((await caja.movimientos({})).saldos.efectivo).toBe(0);
    // Con el efectivo en cero, tampoco se puede depositar efectivo en el banco.
    await expect(caja.transferenciaInterna(U, { desde: "EFECTIVO", importe: 1, fecha: new Date(), concepto: null })).rejects.toThrow(/No alcanza/);
  });
});
