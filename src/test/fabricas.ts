// Datos de prueba reutilizables para los tests de integración.
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import * as veh from "@/server/vehiculos";

export const U = 1; // usuario de prueba
export const SALON = 1;
export const INVERSOR = 2;

export const baseAuto = {
  chasis: null, version: "Highline", km: 50_000, color: "Gris", combustible: null, transmision: null,
  ingresadoPor: null, contactoOrigenId: null, fechaIngreso: "2026-10-01", ubicacion: "SALON" as const, observaciones: null,
};

export const baseContacto = {
  apellido: "Pérez", dniCuit: null, email: null, localidad: null, origen: "WHATSAPP" as const, calificacionMonto: null,
  calificacionBanco: null, productoInteres: null, usadoAEntregar: null, observaciones: null, proximoContacto: null,
};

/** Auto comprado (pagado por banco), con papeles y peritaje, habilitado para la venta. */
export async function autoDisponible(dominio: string, d: Partial<veh.DatosVehiculo> = {}, pago: veh.PagoCompra = { modo: "PAGADO", medio: "BANCO" }) {
  const id = await veh.crearVehiculo(
    U,
    { ...baseAuto, dominio, marca: "Volkswagen", modelo: "Amarok", anio: 2019, tipoIngreso: "COMPRA", participeId: INVERSOR, monedaCompra: "ARS", valorCompra: 10_000_000, tcIngreso: 1_500, ...d },
    pago,
  );
  const docs = await db.select().from(s.documentosVehiculo).where(eq(s.documentosVehiculo.vehiculoId, id));
  for (const doc of docs) await veh.registrarDocumento(U, id, doc.id, "RECIBIDO", null);
  await veh.guardarPeritaje(U, id, { fecha: "2026-10-02", perito: null, resultado: "APTO", reparacionEstimada: null, observaciones: null });
  await veh.habilitarVenta(U, id);
  return id;
}

export const saldoCaja = async () =>
  (await db.select().from(s.movimientosCaja)).filter((m) => !m.anulado).reduce((a, m) => a + (m.sentido === "INGRESO" ? m.importe : -m.importe), 0);
