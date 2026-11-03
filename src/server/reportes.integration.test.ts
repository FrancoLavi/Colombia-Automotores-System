import { beforeAll, describe, expect, it } from "vitest";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseContacto, U, fondear } from "@/test/fabricas";
import { hoyIso } from "@/lib/formato";
import { periodoDe } from "@/domain/dashboard";
import * as con from "./contactos";
import * as ven from "./ventas";
import * as caja from "./caja";
import * as cfg from "./configuracion";
import * as rep from "./reportes";

const anio = new Date().getFullYear();
const mes = periodoDe(new Date());

beforeAll(async () => {
  await prepararBase();
  await fondear();
});

describe("personas, ganancias por dueño e históricos", () => {
  let bruno = 0;
  let empleado = 0;

  it("el sueldo exige a quién corresponde", async () => {
    await cfg.crearPersona(U, "Bruno", "SOCIO");
    await cfg.crearPersona(U, "Pablo", "EMPLEADO");
    const personas = await cfg.listarPersonas();
    bruno = personas.find((p) => p.nombre === "Bruno")!.id;
    empleado = personas.find((p) => p.nombre === "Pablo")!.id;
    await expect(caja.crearMovimiento(U, { categoria: "SUELDO", sentido: null, medio: "EFECTIVO", importe: 500_000, concepto: "Sueldo octubre", fecha: new Date(), participeId: null })).rejects.toThrow(/a quién/);
    await caja.crearMovimiento(U, { categoria: "SUELDO", sentido: null, medio: "EFECTIVO", importe: 500_000, concepto: "Sueldo octubre", fecha: new Date(), participeId: null, personaId: empleado });
    // Un gasto del salón no se atribuye a nadie aunque venga una persona.
    await caja.crearMovimiento(U, { categoria: "GASTO_SALON", sentido: null, medio: "EFECTIVO", importe: 85_000, concepto: "Publicidad", fecha: new Date(), participeId: null, personaId: bruno });
    const { movimientos } = await caja.movimientos({});
    expect(movimientos.find((m) => m.m.concepto === "Publicidad")!.m.personaId).toBeNull();
  });

  it("venta cerrada: la parte del salón queda en su caja, el socio la retira como movimiento y el inversor cobra la suya", async () => {
    const auto = await autoDisponible("AA111AA");
    const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Marcos", telefono: "2915550142" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_000_000, observaciones: null });
    await ven.agregarPago(U, op, { tipo: "TRANSFERENCIA", importe: 12_000_000, fecha: hoyIso(), medio: "BANCO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, null);
    // K5: solo queda pendiente lo del inversor; la parte del salón no se "paga".
    const pendientes = await caja.pendientesPorPagar();
    expect(pendientes.every((g) => g.participe.tipo === "INVERSOR")).toBe(true);
    for (const g of pendientes) await caja.pagarDistribucion(U, g.d.id, "BANCO");
    await caja.crearMovimiento(U, { categoria: "RETIRO_SOCIO", sentido: null, medio: "BANCO", importe: 1_250_000, concepto: "Retiro ganancia V-0001", fecha: new Date(), participeId: null, personaId: bruno });

    const g = await rep.gananciasPorDueno(anio);
    const deEsteMes = g.meses.find((m) => m.periodo === mes)!;
    // Ganancia 2 M sobre costo 10 M: base 1,5 M → inversor 750.000, salón 1.250.000.
    // La devolución del capital (K10) se paga igual pero no cuenta como ganancia de nadie.
    expect(Object.values(deEsteMes.porParticipe).sort()).toEqual([1_250_000, 750_000]);
    expect(g.total).toBe(2_000_000);
    // El salón va primero; el inversor ya cobró la suya.
    expect(g.porDueno.map((d) => [d.participe.tipo, d.total, d.cobrado, d.pendiente])).toEqual([
      ["SALON", 1_250_000, 1_250_000, 0],
      ["INVERSOR", 750_000, 750_000, 0],
    ]);
    expect(g.ventas).toHaveLength(1);
    // Filtros: por mes y por auto.
    const otroMes = `${anio}-${mes.endsWith("01") ? "02" : "01"}`;
    expect((await rep.gananciasPorDueno(anio, { mes: otroMes })).total).toBe(0);
    expect((await rep.gananciasPorDueno(anio, { mes })).total).toBe(2_000_000);
    expect((await rep.gananciasPorDueno(anio, { auto: { patente: "aa 111" } })).total).toBe(2_000_000);
    expect((await rep.gananciasPorDueno(anio, { auto: { marca: "Ford" } })).total).toBe(0);
  });

  it("cuánto se llevó cada persona", async () => {
    const { resumen } = await rep.retirosPorPersona(anio);
    expect(resumen.find((r) => r.persona.id === empleado)).toMatchObject({ sueldos: 500_000, total: 500_000 });
    expect(resumen.find((r) => r.persona.id === bruno)).toMatchObject({ retiros: 1_250_000, total: 1_250_000 });
  });

  it("históricos de ventas, autos e ingresos/egresos", async () => {
    const v = await rep.historicoVentas(anio);
    expect(v.ventas).toHaveLength(1);
    expect(v.porMes.find((m) => m.periodo === mes)).toMatchObject({ unidades: 1, facturado: 12_000_000, ganancia: 2_000_000 });

    const a = await rep.historicoAutos(anio);
    expect(a.autos[0]).toMatchObject({ numero: "V-0001" });
    expect(a.movimientos.some((m) => m.a.descripcion?.startsWith("Vendido"))).toBe(true);

    const r = await rep.resumenMensual(anio);
    const m = r.meses.find((x) => x.periodo === mes)!;
    expect(m.sueldos).toBe(500_000);
    // Ingreso: la venta. Egresos: compra, sueldo, publicidad, pago al inversor y retiro del salón.
    expect(m.ingresos).toBe(12_000_000);
    expect(m.egresos).toBe(10_000_000 + 500_000 + 85_000 + 750_000 + 1_250_000);
  });
});
