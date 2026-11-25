import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseContacto, fondear, INVERSOR, SALON, U } from "@/test/fabricas";
import * as con from "./contactos";
import * as ven from "./ventas";
import * as caja from "./caja";

beforeAll(async () => {
  await prepararBase();
  await fondear(50_000_000);
});

let telefono = 2915550300;
async function vender(vehiculoId: number, precio: number) {
  const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Cliente", telefono: String(telefono++) });
  const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId, precioVenta: precio, observaciones: null });
  await ven.agregarPago(U, op, { tipo: "TRANSFERENCIA", importe: precio, fecha: "2026-11-05", medio: "BANCO", banco: null, vence: null, cobradoAhora: true });
  await ven.cerrarOperacion(U, op, 1_555);
  const liq = (await db.query.liquidaciones.findFirst({ where: eq(s.liquidaciones.operacionId, op) }))!;
  return { op, liq };
}

const deudasDe = async (liquidacionId: number) =>
  db.select().from(s.distribuciones).where(and(eq(s.distribuciones.liquidacionId, liquidacionId), eq(s.distribuciones.participeId, INVERSOR)));

describe("corregir la compra de un auto ya vendido (R6, V7)", () => {
  it("con el dólar mal fijado, rehace el reparto y lo que se le debe al inversor", async () => {
    // USD 10.000 cargados con el blue de hoy ($ 1.555) en vez del de la compra ($ 1.000).
    const id = await autoDisponible("COR001", { participeId: INVERSOR, monedaCompra: "USD", valorCompra: 10_000, tcIngreso: 1_555 });
    const { liq } = await vender(id, 12_000_000);
    expect(liq.costo).toBe(15_550_000);
    expect(liq.parteInversor).toBe(-1_775_000);
    expect((await caja.patrimonio()).deudaInversores).toBe(13_775_000);

    await ven.corregirCompraVendido(U, id, { monedaCompra: "USD", valorCompra: 10_000, tcIngreso: 1_000 });

    const v = (await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) }))!;
    expect(v).toMatchObject({ valorCompraArs: 10_000_000, valorCompraUsd: 10_000, tcIngreso: 1_000 });
    const l = (await db.query.liquidaciones.findFirst({ where: eq(s.liquidaciones.id, liq.id) }))!;
    expect(l).toMatchObject({ regla: "INVERSOR_BASE", costo: 10_000_000, ganancia: 2_000_000, parteInversor: 750_000, parteSalon: 1_250_000, tcIngreso: 1_000, costoUsd: 10_000 });
    const deudas = await deudasDe(liq.id);
    expect(deudas.map((d) => [d.tipo, d.importe, d.estado]).sort()).toEqual([["CAPITAL", 10_000_000, "PENDIENTE"], ["GANANCIA", 750_000, "PENDIENTE"]]);
    expect((await caja.patrimonio()).deudaInversores).toBe(10_750_000);

    // T1: queda en el historial del auto y de la venta.
    const historial = await db.select().from(s.auditoria).where(eq(s.auditoria.entidadId, id));
    expect(historial.some((h) => h.entidad === "vehiculo" && /Compra corregida después de vendido/.test(h.descripcion ?? ""))).toBe(true);
  });

  it("si ya se le pagó al inversor, pide anular ese pago primero (K16) y después corrige", async () => {
    const id = await autoDisponible("COR002", { participeId: INVERSOR, monedaCompra: "USD", valorCompra: 10_000, tcIngreso: 1_555 });
    const { liq } = await vender(id, 12_000_000);
    const [mov] = await caja.liquidarAlInversor(U, liq.id, INVERSOR, "BANCO");
    await expect(ven.corregirCompraVendido(U, id, { monedaCompra: "USD", valorCompra: 10_000, tcIngreso: 1_000 })).rejects.toThrow(/ya se le pagó/);
    // No cambió nada.
    expect((await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) }))!.tcIngreso).toBe(1_555);

    await caja.anularMovimiento(U, mov, "Estaba mal el dólar de la compra");
    await ven.corregirCompraVendido(U, id, { monedaCompra: "USD", valorCompra: 10_000, tcIngreso: 1_000 });
    expect((await deudasDe(liq.id)).reduce((a, d) => a + d.importe, 0)).toBe(10_750_000);
  });

  it("no corrige autos del salón ni autos que siguen en stock", async () => {
    const delSalon = await autoDisponible("COR003", { participeId: SALON, valorCompra: 5_000_000 });
    await vender(delSalon, 6_000_000);
    await expect(ven.corregirCompraVendido(U, delSalon, { monedaCompra: "ARS", valorCompra: 4_000_000, tcIngreso: 1_500 })).rejects.toThrow(/la pagó el salón/);

    const enStock = await autoDisponible("COR004", { participeId: INVERSOR });
    await expect(ven.corregirCompraVendido(U, enStock, { monedaCompra: "ARS", valorCompra: 9_000_000, tcIngreso: 1_500 })).rejects.toThrow(/todavía no se vendió/);
  });
});
