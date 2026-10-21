import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseAuto, baseContacto, INVERSOR, saldoCaja, U } from "@/test/fabricas";
import { desdeArgentina } from "@/domain/entregas";
import * as veh from "./vehiculos";
import * as con from "./contactos";
import * as ven from "./ventas";

beforeAll(prepararBase);

const datos = (d: Partial<veh.DatosVehiculo> = {}): veh.DatosVehiculo => ({
  ...baseAuto, dominio: "PR123EN", marca: "Fiat", modelo: "Cronos", anio: 2021, tipoIngreso: "COMPRA", participeId: INVERSOR,
  monedaCompra: "ARS", valorCompra: 9_000_000, tcIngreso: 1_500, ...d,
});
const papeles = (id: number) =>
  db
    .select({ id: s.documentosVehiculo.id, nombre: s.tiposDocumento.nombre, estado: s.documentosVehiculo.estado, archivoUrl: s.documentosVehiculo.archivoUrl })
    .from(s.documentosVehiculo)
    .innerJoin(s.tiposDocumento, eq(s.tiposDocumento.id, s.documentosVehiculo.tipoDocumentoId))
    .where(eq(s.documentosVehiculo.vehiculoId, id));

describe("auto prendado", () => {
  let id = 0;
  it("pide la cancelación de prenda para habilitarlo", async () => {
    id = await veh.crearVehiculo(U, datos({ prendado: true, prendaDetalle: "Banco X, saldo $ 2.000.000" }), { modo: "SIN_REGISTRO" });
    const docs = await papeles(id);
    expect(docs.map((d) => d.nombre).sort()).toEqual(["Cancelación de prenda", "Título", "VTV"]);
    for (const d of docs.filter((d) => d.nombre !== "Cancelación de prenda")) await veh.registrarDocumento(U, id, d.id, "RECIBIDO", null);
    await veh.guardarPeritaje(U, id, { fecha: "2026-10-02", perito: null, resultado: "APTO", reparacionEstimada: null, observaciones: null });
    await expect(veh.habilitarVenta(U, id)).rejects.toThrow(/Cancelación de prenda/);
  });

  it("si se le saca la prenda, el papel pendiente desaparece", async () => {
    await veh.actualizarVehiculo(U, id, datos({ prendado: false }));
    expect((await papeles(id)).map((d) => d.nombre)).not.toContain("Cancelación de prenda");
    await veh.habilitarVenta(U, id);
  });

  it("un auto sin prenda no lo pide", async () => {
    const otro = await veh.crearVehiculo(U, datos({ dominio: "SP000AA" }), { modo: "SIN_REGISTRO" });
    expect((await papeles(otro)).map((d) => d.nombre)).not.toContain("Cancelación de prenda");
  });
});

describe("comprobante de un papel", () => {
  it("solo con el papel recibido; reemplaza y se puede quitar", async () => {
    const id = await veh.crearVehiculo(U, datos({ dominio: "CO111MP" }), { modo: "SIN_REGISTRO" });
    const [titulo] = (await papeles(id)).filter((d) => d.nombre === "Título");
    await expect(veh.adjuntarComprobante(U, id, titulo.id, { url: "a.jpg", nombre: "titulo.jpg" })).rejects.toThrow(/recibido/);
    await veh.registrarDocumento(U, id, titulo.id, "RECIBIDO", null);
    expect(await veh.adjuntarComprobante(U, id, titulo.id, { url: "a.jpg", nombre: "titulo.jpg" })).toBeNull();
    expect(await veh.adjuntarComprobante(U, id, titulo.id, { url: "b.jpg", nombre: "titulo2.jpg" })).toBe("a.jpg");
    const [conFoto] = (await papeles(id)).filter((d) => d.nombre === "Título");
    expect(conFoto).toMatchObject({ estado: "RECIBIDO", archivoUrl: expect.stringMatching(/^\/api\/archivos\/\d+$/) });
    expect(await veh.adjuntarComprobante(U, id, titulo.id, null)).toBe("b.jpg");
    expect((await papeles(id)).find((d) => d.nombre === "Título")!.archivoUrl).toBeNull();
    expect(await db.select().from(s.archivos).where(eq(s.archivos.vehiculoId, id))).toHaveLength(0);
  });
});

describe("costo del peritaje", () => {
  it("se suma al costo real y al precio sugerido; cambiarlo reemplaza el gasto", async () => {
    const id = await veh.crearVehiculo(U, datos({ dominio: "PE111RI" }), { modo: "SIN_REGISTRO" });
    const caja = await saldoCaja();
    const p = { fecha: "2026-10-05", perito: "Taller Sur", resultado: "APTO" as const, reparacionEstimada: null, observaciones: null };
    await veh.guardarPeritaje(U, id, p, { importe: 60_000, estado: "PAGADO", medio: "EFECTIVO" });
    let f = (await veh.fichaVehiculo(id))!;
    expect(f.costo).toBe(9_060_000);
    expect(f.sugerido).toBe(Math.round(9_060_000 * (1 + f.margenBase)));
    expect(f.gastos.map((g) => g.categoria)).toEqual(["Peritaje"]);
    expect(f.peritaje).toMatchObject({ costo: 60_000, gastoId: f.gastos[0].g.id });
    expect(await saldoCaja()).toBe(caja - 60_000);

    // Guardar sin cambiar el costo no duplica el gasto.
    await veh.guardarPeritaje(U, id, { ...p, observaciones: "ok" }, { importe: 60_000, estado: "PAGADO", medio: "EFECTIVO" });
    expect((await veh.fichaVehiculo(id))!.gastos).toHaveLength(1);

    await veh.guardarPeritaje(U, id, p, { importe: 80_000, estado: "PENDIENTE", medio: "EFECTIVO" });
    f = (await veh.fichaVehiculo(id))!;
    expect(f.costo).toBe(9_080_000);
    expect(f.gastos).toHaveLength(1);
    expect(await saldoCaja()).toBe(caja); // el pago anterior se anuló; el nuevo quedó a pagar

    // Si se borra el gasto desde la ficha, el peritaje queda sin costo.
    await veh.eliminarGasto(U, id, f.gastos[0].g.id);
    expect((await veh.fichaVehiculo(id))!.peritaje).toMatchObject({ costo: null, gastoId: null });
  });
});

describe("gastos de venta y entrega programada", () => {
  let op = 0;
  let auto = 0;

  it("los gastos suben el total que paga el cliente, no la ganancia", async () => {
    auto = await autoDisponible("GV111AA");
    const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Lucía", telefono: "2915550199" });
    op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_000_000, observaciones: null });
    await ven.agregarGastoVenta(U, op, "Transferencia (formularios 08)", 250_000);
    await ven.agregarGastoVenta(U, op, "Gestoría", 100_000);
    let f = (await ven.fichaOperacion(op))!;
    expect(f.total).toBe(12_350_000);
    expect(f.cobertura.faltante).toBe(12_350_000);

    // Se puede cobrar más que el precio (hasta el total), no más que el total.
    await ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 12_200_000, fecha: "2026-10-20", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    await expect(
      ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 200_000, fecha: "2026-10-20", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true }),
    ).rejects.toThrow(/faltan cubrir solo \$ 150\.000/);
    await expect(ven.cerrarOperacion(U, op, null)).rejects.toThrow(/Faltan cubrir \$ 150\.000/);

    // Sacar un gasto que deja los pagos por encima del total no se permite.
    const gestoria = f.gastosVenta.find((g) => g.concepto === "Gestoría")!;
    const transf = f.gastosVenta.find((g) => g.concepto !== "Gestoría")!;
    await expect(ven.quitarGastoVenta(U, op, transf.id)).rejects.toThrow(/superan el total/);
    await ven.quitarGastoVenta(U, op, gestoria.id);
    f = (await ven.fichaOperacion(op))!;
    expect(f.total).toBe(12_250_000);

    await ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 50_000, fecha: "2026-10-20", medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, null);
    f = (await ven.fichaOperacion(op))!;
    expect(f.liquidacion).toMatchObject({ precio: 12_000_000, costo: 10_000_000, ganancia: 2_000_000 });
    const aPagar = await db
      .select()
      .from(s.cuentasPendientes)
      .where(and(eq(s.cuentasPendientes.operacionId, op), eq(s.cuentasPendientes.tipo, "A_PAGAR")));
    expect(aPagar).toEqual([expect.objectContaining({ origen: "GASTO", contraparte: "Transferencia (formularios 08)", saldo: 250_000 })]);
    await expect(ven.agregarGastoVenta(U, op, "Flete", 10_000)).rejects.toThrow(/antes de cerrar/);
  });

  it("la entrega programada aparece en el calendario y avisa 3 días antes", async () => {
    const cuando = desdeArgentina("2026-10-24", "16:30");
    await ven.programarEntrega(U, op, cuando, "Salón");
    const octubre = await ven.entregasProgramadas({ desde: desdeArgentina("2026-10-01", "00:00"), hasta: desdeArgentina("2026-11-01", "00:00") });
    expect(octubre.map((e) => e.op.id)).toContain(op);
    expect(await ven.entregasProgramadas({ desde: desdeArgentina("2026-11-01", "00:00"), hasta: desdeArgentina("2026-12-01", "00:00") })).toHaveLength(0);

    const [lejos] = (await ven.entregasProgramadas(undefined, desdeArgentina("2026-10-19", "10:00"))).filter((e) => e.op.id === op);
    expect(lejos.alarma).toBeNull();
    const [cerca] = (await ven.entregasProgramadas(undefined, desdeArgentina("2026-10-21", "10:00"))).filter((e) => e.op.id === op);
    expect(cerca.alarma).toMatchObject({ dias: 3, severidad: "AVISO", texto: "Entrega en 3 días · todo listo" });
    expect(cerca.op.lugarEntrega).toBe("Salón");

    await ven.entregarOperacion(U, op, desdeArgentina("2026-10-24", "17:00"));
    expect((await ven.entregasProgramadas()).map((e) => e.op.id)).not.toContain(op);
    await expect(ven.programarEntrega(U, op, cuando, null)).rejects.toThrow(/entregada/);
  });

  it("si falta cobrar o hay papeles pendientes, la alarma es crítica y lo detalla", async () => {
    const otro = await autoDisponible("GV222BB");
    const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Tomás", telefono: "2915550111" });
    const op2 = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: otro, precioVenta: 11_000_000, observaciones: null });
    await ven.agregarPago(U, op2, { tipo: "SENIA", importe: 500_000, fecha: "2026-10-20", medio: "EFECTIVO", banco: null, vence: "2026-10-30", cobradoAhora: true });
    const [vtv] = (await papeles(otro)).filter((d) => d.nombre === "VTV");
    await veh.registrarDocumento(U, otro, vtv.id, "PENDIENTE", null);
    await ven.programarEntrega(U, op2, desdeArgentina("2026-10-23", "10:00"), null);
    const [e] = (await ven.entregasProgramadas(undefined, desdeArgentina("2026-10-21", "09:00"))).filter((x) => x.op.id === op2);
    expect(e.alarma).toMatchObject({ severidad: "CRITICA", dias: 2 });
    expect(e.alarma!.texto).toBe("Entrega en 2 días: la venta no está cerrada, faltan cubrir $ 10.500.000, falta 1 papel");
  });
});
