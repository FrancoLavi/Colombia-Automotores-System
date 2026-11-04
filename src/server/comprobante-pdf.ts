import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { ETIQUETA_CATEGORIA } from "@/domain/caja";
import { diaArgentina, horaArgentina } from "@/domain/entregas";
import { fecha } from "@/lib/formato";
import { fichaMovimiento } from "./caja";
import { obtenerDatosSalon } from "./parametros";
import { ANCHO, A4, FONDO, Hoja, MARGEN, SUAVE, pesos } from "./preventa-pdf";

/** Número de comprobante a partir del movimiento de caja: C-000123. */
export const numeroComprobante = (id: number) => `C-${String(id).padStart(6, "0")}`;

/**
 * Comprobante de un cobro o un pago (HU-5.10): para dárselo a quien pagó o a quien cobró.
 * Sale del movimiento de caja: quién, por qué, de qué auto, el medio y el importe, y si era una
 * cuenta pendiente, cuánto queda. Si el movimiento está anulado, lo dice en grande.
 */
export async function generarComprobante(movimientoId: number, impresoPor: string): Promise<{ pdf: Uint8Array; nombre: string } | null> {
  const m = await fichaMovimiento(movimientoId);
  if (!m) return null;
  const [salon, auto, cuenta, cliente] = await Promise.all([
    obtenerDatosSalon(),
    m.vehiculoId ? db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, m.vehiculoId) }) : null,
    m.cuentaPendienteId ? db.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, m.cuentaPendienteId) }) : null,
    m.operacionId
      ? db
          .select({ nombre: s.contactos.nombre, apellido: s.contactos.apellido, dni: s.contactos.dniCuit })
          .from(s.operaciones)
          .innerJoin(s.contactos, eq(s.contactos.id, s.operaciones.contactoId))
          .where(eq(s.operaciones.id, m.operacionId))
          .then((r) => r[0] ?? null)
      : null,
  ]);
  const cobro = m.sentido === "INGRESO";
  const numero = numeroComprobante(m.id);
  // Con quién: la cuenta, el inversor, la persona o el cliente de la venta, en ese orden.
  const contraparte =
    cuenta?.contraparte ?? m.participe ?? m.persona ?? (cliente ? `${cliente.nombre} ${cliente.apellido ?? ""}`.trim() : null);

  const doc = await PDFDocument.create();
  doc.setTitle(`Comprobante ${numero} - ${salon.nombre}`);
  doc.setCreator(salon.nombre);
  const f = { normal: await doc.embedFont(StandardFonts.Helvetica), negrita: await doc.embedFont(StandardFonts.HelveticaBold) };
  const h = new Hoja(doc, f);
  const ahora = new Date();

  // Encabezado del salón.
  h.texto(salon.nombre, MARGEN, { tam: 17, negrita: true });
  h.texto(cobro ? "COMPROBANTE DE COBRO" : "COMPROBANTE DE PAGO", MARGEN + ANCHO, { tam: 13, negrita: true, derecha: true });
  h.y -= 15;
  const datos = [salon.direccion, salon.telefono && `Tel. ${salon.telefono}`, salon.email, salon.cuit && `CUIT ${salon.cuit}`].filter(Boolean).join(" · ");
  if (datos) h.texto(datos, MARGEN, { tam: 8.5, color: SUAVE });
  h.texto(`N° ${numero}`, MARGEN + ANCHO, { tam: 10, negrita: true, derecha: true });
  h.y -= 12;
  h.linea();
  h.y -= 18;

  h.titulo("Datos");
  h.campos([
    ["Fecha", fecha(diaArgentina(m.fecha))],
    ["Hora", horaArgentina(m.fecha)],
    [cobro ? "Recibimos de" : "Pagamos a", contraparte],
    ["Medio", m.medio === "EFECTIVO" ? "Efectivo" : "Banco / transferencia"],
    ["Tipo", ETIQUETA_CATEGORIA[m.categoria]],
    ["Registró", m.usuario],
  ]);
  if (cliente?.dni) h.campos([["DNI / CUIT", cliente.dni]]);

  h.titulo("Concepto");
  h.parrafo(m.concepto);
  h.y -= 4;
  if (auto) {
    h.campos([
      ["Marca", auto.marca],
      ["Modelo", `${auto.modelo}${auto.version ? ` ${auto.version}` : ""} ${auto.anio}`],
      ["Patente", auto.dominio ?? "Sin patente"],
    ]);
  }

  // Importe destacado.
  h.y -= 10;
  h.page.drawRectangle({ x: MARGEN, y: h.y - 14, width: ANCHO, height: 34, color: FONDO });
  h.texto(cobro ? "Importe recibido" : "Importe pagado", MARGEN + 10, { tam: 11, negrita: true, y: h.y - 2 });
  h.texto(pesos(m.importe), MARGEN + ANCHO - 10, { tam: 16, negrita: true, derecha: true, y: h.y - 4 });
  h.y -= 40;

  if (cuenta) {
    h.importe("Total de la cuenta", pesos(cuenta.importe));
    h.importe(cuenta.saldo === 0 ? "Saldo: cancelada" : "Queda pendiente", pesos(cuenta.saldo), { negrita: true });
  }

  // Firmas.
  h.y = Math.min(h.y - 60, 200);
  const col = ANCHO / 2;
  for (const [i, t] of [cobro ? "Firma de quien paga" : "Firma de quien recibe", `Por ${salon.nombre}`].entries()) {
    const x = MARGEN + i * col + 20;
    h.page.drawLine({ start: { x, y: h.y }, end: { x: x + col - 40, y: h.y }, thickness: 0.7, color: SUAVE });
    h.texto(t, x, { tam: 8.5, color: SUAVE, y: h.y - 12 });
  }

  h.texto(`Impreso el ${fecha(diaArgentina(ahora))} ${horaArgentina(ahora)} por ${impresoPor}`, MARGEN, { tam: 7.5, color: SUAVE, y: MARGEN - 10 });

  if (m.anulado) {
    h.page.drawText("ANULADO", { x: 140, y: A4.alto / 2 - 60, size: 90, font: f.negrita, color: rgb(0.75, 0.2, 0.2), opacity: 0.25, rotate: degrees(35) });
    h.texto(`Anulado${m.motivoAnulacion ? `: ${m.motivoAnulacion}` : ""}`, MARGEN, { tam: 9, negrita: true, color: rgb(0.6, 0.15, 0.15), y: MARGEN + 4 });
  }

  return { pdf: await doc.save(), nombre: `${numero}.pdf` };
}
