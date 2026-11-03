import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseAuto as base, baseContacto as contacto, habilitar, INVERSOR, saldoCaja, SALON, U } from "@/test/fabricas";
import * as veh from "./vehiculos";
import * as con from "./contactos";
import * as ven from "./ventas";

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
    // K10: además del reparto R3, al inversor se le devuelven los 10 M que puso. Pero el Fiesta
    // de la permuta quedó a nombre suyo, así que 4 M de esos 10 ya se los llevó en auto (K12):
    // en plata se le devuelven 6 M. Si no, cobraría dos veces y la caja del salón quedaría corta.
    expect(f.distribuciones.map((d) => d.d.importe).sort()).toEqual([1_075_000, 6_000_000, 825_000]);
    expect(f.distribuciones.filter((d) => d.d.tipo === "CAPITAL").map((d) => d.d.importe)).toEqual([6_000_000]);
    expect(f.capitalReinvertido).toBe(4_000_000);
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

describe("K12: el usado a cuenta del capital solo si queda a nombre del inversor", () => {
  it("usado del salón: al inversor se le devuelve todo el capital en plata", async () => {
    const auto = await autoDisponible("FF666FF");
    const cliente = await con.crearContacto(U, { ...contacto, nombre: "Rita", telefono: "2915550199" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_000_000, observaciones: null });
    // El usado lo toma el salón para sí: paga con él parte del auto del inversor.
    await ven.tomarUsado(U, op, { ...base, dominio: "RST456", marca: "Chevrolet", modelo: "Onix", anio: 2018, participeId: SALON, monedaCompra: "ARS", valorCompra: 5_000_000, tcIngreso: 1_500 });
    await ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 7_000_000, fecha: "2026-10-12", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, 1_550);

    const f = (await ven.fichaOperacion(op))!;
    expect(f.capitalReinvertido).toBe(0);
    // El auto se lo queda el salón, así que la plata del inversor sale entera de la caja.
    expect(f.distribuciones.filter((d) => d.d.tipo === "CAPITAL").map((d) => d.d.importe)).toEqual([10_000_000]);
  });
});

describe("K12 en cadena: el inversor reinvierte venta tras venta", () => {
  // El modelo que plantea el cliente, dos eslabones: en cada venta el inversor se lleva lo que
  // puso en ESE auto más su ganancia, menos lo que reinvierte en ESA misma venta.
  let cruce = 0;
  let corsa = 0;
  const ops: number[] = [];

  const capitalDe = (f: { distribuciones: { d: { tipo: string; importe: number } }[] }) =>
    f.distribuciones.find((d) => d.d.tipo === "CAPITAL")!.d.importe;

  it("primera venta: puso 10 M y se lleva un usado de 4 M → cobra 6 M", async () => {
    const auto = await autoDisponible("GG777GG");
    const cliente = await con.crearContacto(U, { ...contacto, nombre: "Ana", telefono: "2915550211" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_000_000, observaciones: null });
    ops.push(op);
    cruce = await ven.tomarUsado(U, op, { ...base, dominio: "KL111CR", marca: "Chevrolet", modelo: "Cruze", anio: 2017, participeId: INVERSOR, monedaCompra: "ARS", valorCompra: 4_000_000, tcIngreso: 1_500 });
    await ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 8_000_000, fecha: "2026-10-12", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, 1_550);

    const f = (await ven.fichaOperacion(op))!;
    expect(f.liquidacion).toMatchObject({ regla: "INVERSOR_BASE", parteInversor: 750_000, parteSalon: 1_250_000 });
    expect(capitalDe(f)).toBe(6_000_000); // 10 M − 4 M del Cruze
  });

  it("segunda venta: el capital del Cruze es su valor de toma, menos la nueva reinversión", async () => {
    await habilitar(cruce);
    const cliente = await con.crearContacto(U, { ...contacto, nombre: "Beto", telefono: "2915550212" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: cruce, precioVenta: 5_000_000, observaciones: null });
    ops.push(op);
    corsa = await ven.tomarUsado(U, op, { ...base, dominio: "KL222CO", marca: "Chevrolet", modelo: "Corsa", anio: 2013, participeId: INVERSOR, monedaCompra: "ARS", valorCompra: 1_500_000, tcIngreso: 1_500 });
    await ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 3_500_000, fecha: "2026-10-20", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, 1_550);

    const f = (await ven.fichaOperacion(op))!;
    // El Cruze entró por permuta: su capital es el valor de toma, sin los gastos (K10).
    expect(f.liquidacion).toMatchObject({ regla: "INVERSOR_BASE", costo: 4_000_000, parteInversor: 300_000, parteSalon: 700_000 });
    // 4 M que tenía puesto en el Cruze − 1,5 M que reinvierte en el Corsa (K12).
    expect(f.capitalReinvertido).toBe(1_500_000);
    expect(capitalDe(f)).toBe(2_500_000);
  });

  it("al final de la cadena no le falta ni le sobra un peso", async () => {
    // Entre la plata que cobró y el auto que todavía tiene, el inversor recupera lo que puso
    // más sus ganancias. Ni dos veces lo mismo, ni de menos.
    const suyas = await db
      .select({ tipo: s.distribuciones.tipo, importe: s.distribuciones.importe })
      .from(s.distribuciones)
      .innerJoin(s.liquidaciones, eq(s.liquidaciones.id, s.distribuciones.liquidacionId))
      .where(and(eq(s.distribuciones.participeId, INVERSOR), inArray(s.liquidaciones.operacionId, ops)));
    const cobrado = suyas.reduce((a, d) => a + d.importe, 0);
    const autoQueLeQueda = (await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, corsa) }))!.valorCompraArs;
    expect(cobrado + autoQueLeQueda).toBe(10_000_000 + 750_000 + 300_000);
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
