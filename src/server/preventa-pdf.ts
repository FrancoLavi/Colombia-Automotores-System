import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { ETIQUETA_ORIGEN } from "@/domain/contactos";
import { ETIQUETA_OPERACION, ETIQUETA_PAGO } from "@/domain/ventas";
import { diaArgentina, horaArgentina } from "@/domain/entregas";
import { fecha } from "@/lib/formato";
import { fichaOperacion } from "./ventas";
import { obtenerDatosSalon } from "./parametros";

// Modelo: la preventa del sistema anterior (encabezado del salón, datos del cliente, propuesta comercial,
// gastos, forma de pago, leyendas y firmas; en la segunda hoja, la ficha de la unidad).

export const A4 = { ancho: 595.28, alto: 841.89 };
export const MARGEN = 42;
export const ANCHO = A4.ancho - 2 * MARGEN;
export const TINTA = rgb(0.106, 0.122, 0.141);
export const SUAVE = rgb(0.42, 0.45, 0.49);
export const LINEA = rgb(0.82, 0.8, 0.76);
export const FONDO = rgb(0.96, 0.95, 0.93);

const pesosFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
export const pesos = (n: number) => `${n < 0 ? "-" : ""}$ ${pesosFmt.format(Math.abs(n))}`;

/** Helvetica estándar solo codifica WinAnsi: se quitan acentos raros y símbolos fuera de ese juego. */
const EXTRA = new Set("–—‘’“”•…€·");
function limpio(t: string | null | undefined): string {
  if (!t) return "";
  return Array.from(t.replace(/−/g, "-").replace(/[\r\t]/g, " "))
    .map((c) => (c.charCodeAt(0) < 256 || EXTRA.has(c) ? c : c.normalize("NFKD").replace(/[^\x20-\xff]/g, "") || "?"))
    .join("");
}

export class Hoja {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private f: { normal: PDFFont; negrita: PDFFont },
  ) {
    this.page = doc.addPage([A4.ancho, A4.alto]);
    this.y = A4.alto - MARGEN;
  }

  texto(t: string, x: number, o: { tam?: number; negrita?: boolean; color?: typeof TINTA; derecha?: boolean; y?: number } = {}) {
    const font = o.negrita ? this.f.negrita : this.f.normal;
    const tam = o.tam ?? 9.5;
    const s = limpio(t);
    const w = font.widthOfTextAtSize(s, tam);
    this.page.drawText(s, { x: o.derecha ? x - w : x, y: o.y ?? this.y, size: tam, font, color: o.color ?? TINTA });
    return w;
  }

  /** Corta el texto en líneas que entren en `ancho`. */
  lineas(t: string, ancho: number, tam = 9.5, negrita = false): string[] {
    const font = negrita ? this.f.negrita : this.f.normal;
    const out: string[] = [];
    for (const parrafo of limpio(t).split("\n")) {
      let linea = "";
      for (const palabra of parrafo.split(/\s+/)) {
        const prueba = linea ? `${linea} ${palabra}` : palabra;
        if (font.widthOfTextAtSize(prueba, tam) > ancho && linea) {
          out.push(linea);
          linea = palabra;
        } else linea = prueba;
      }
      out.push(linea);
    }
    return out;
  }

  parrafo(t: string, o: { tam?: number; color?: typeof TINTA; ancho?: number; x?: number } = {}) {
    const tam = o.tam ?? 9.5;
    for (const l of this.lineas(t, o.ancho ?? ANCHO, tam)) {
      this.texto(l, o.x ?? MARGEN, { tam, color: o.color });
      this.y -= tam * 1.35;
    }
  }

  linea(y = this.y, color = LINEA) {
    this.page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + ANCHO, y }, thickness: 0.7, color });
  }

  titulo(t: string) {
    this.y -= 8;
    this.page.drawRectangle({ x: MARGEN, y: this.y - 5, width: ANCHO, height: 17, color: FONDO });
    this.texto(t.toUpperCase(), MARGEN + 6, { tam: 9, negrita: true });
    this.y -= 22;
  }

  /** Pares etiqueta/valor en dos columnas. */
  campos(pares: [string, string | null | undefined][]) {
    const col = ANCHO / 2;
    for (let i = 0; i < pares.length; i += 2) {
      for (const [j, par] of [pares[i], pares[i + 1]].entries()) {
        if (!par) continue;
        const x = MARGEN + j * col;
        const w = this.texto(`${par[0]}:`, x, { tam: 9, color: SUAVE });
        this.texto(par[1] || "—", x + w + 5, { tam: 9.5 });
      }
      this.y -= 15;
    }
  }

  /** Fila de importe alineada a la derecha. */
  importe(etiqueta: string, valor: string, o: { negrita?: boolean; sangria?: number; tam?: number } = {}) {
    this.texto(etiqueta, MARGEN + 6 + (o.sangria ?? 0), { negrita: o.negrita, tam: o.tam });
    this.texto(valor, MARGEN + ANCHO - 6, { derecha: true, negrita: o.negrita, tam: o.tam });
    this.y -= (o.tam ?? 9.5) * 1.6;
  }
}

export async function generarPreventa(operacionId: number, impresoPor: string): Promise<{ pdf: Uint8Array; nombre: string } | null> {
  const f = await fichaOperacion(operacionId);
  if (!f) return null;
  const [salon, vendedor, papeles] = await Promise.all([
    obtenerDatosSalon(),
    f.op.vendedorId ? db.query.usuarios.findFirst({ where: eq(s.usuarios.id, f.op.vendedorId) }) : null,
    db
      .select({ nombre: s.tiposDocumento.nombre, estado: s.documentosVehiculo.estado, obligatorio: s.tiposDocumento.obligatorio })
      .from(s.documentosVehiculo)
      .innerJoin(s.tiposDocumento, eq(s.tiposDocumento.id, s.documentosVehiculo.tipoDocumentoId))
      .where(eq(s.documentosVehiculo.vehiculoId, f.v.id))
      .orderBy(s.tiposDocumento.orden),
  ]);
  const { op, v, contacto: c } = f;

  const doc = await PDFDocument.create();
  doc.setTitle(`Preventa ${f.numero} - ${salon.nombre}`);
  doc.setCreator(salon.nombre);
  const fuentes = { normal: await doc.embedFont(StandardFonts.Helvetica), negrita: await doc.embedFont(StandardFonts.HelveticaBold) };
  const ahora = new Date();
  const impreso = `${fecha(diaArgentina(ahora))} ${horaArgentina(ahora)}`;
  const auto = `${v.marca} ${v.modelo}${v.version ? ` ${v.version}` : ""} ${v.anio}`;

  const encabezado = (h: Hoja, subtitulo: string) => {
    h.texto(salon.nombre, MARGEN, { tam: 17, negrita: true });
    h.texto("PREVENTA", MARGEN + ANCHO, { tam: 15, negrita: true, derecha: true });
    h.y -= 15;
    const contacto = [salon.direccion, salon.telefono && `Tel. ${salon.telefono}`, salon.email].filter(Boolean).join(" · ");
    if (contacto) h.texto(contacto, MARGEN, { tam: 8.5, color: SUAVE });
    h.texto(f.numero, MARGEN + ANCHO, { tam: 11, negrita: true, derecha: true });
    h.y -= 12;
    if (salon.cuit) h.texto(`CUIT ${salon.cuit}`, MARGEN, { tam: 8.5, color: SUAVE });
    h.texto(subtitulo, MARGEN + ANCHO, { tam: 8.5, color: SUAVE, derecha: true });
    h.y -= 10;
    h.linea(h.y, TINTA);
    h.y -= 16;
  };

  // ---------- Hoja 1: la propuesta ----------
  const h = new Hoja(doc, fuentes);
  encabezado(h, `Generada el ${fecha(op.fechaPreventa)} · Impresa el ${impreso} por ${impresoPor}`);

  h.titulo("Datos del cliente");
  h.campos([
    ["Apellido y nombre", `${c.apellido ? `${c.apellido}, ` : ""}${c.nombre}`],
    ["DNI / CUIT", c.dniCuit],
    ["Teléfono", c.telefono],
    ["Email", c.email],
    ["Localidad", c.localidad],
    ["Cómo nos conoció", ETIQUETA_ORIGEN[c.origen]],
    ["Vendedor", vendedor?.nombre],
    ["Estado", ETIQUETA_OPERACION[op.estado]],
  ]);

  h.titulo("Propuesta comercial");
  h.campos([
    ["Unidad", auto],
    ["Dominio", v.dominio ?? "Sin patente"],
    ["Kilómetros", v.km != null ? pesosFmt.format(v.km) : null],
    ["Color", v.color],
  ]);
  h.y -= 2;
  h.importe("Precio de la unidad", pesos(op.precioVenta), { negrita: true });
  h.linea(h.y + 9);

  h.titulo("Adicionales, gastos y otros");
  if (f.gastosVenta.length === 0) {
    h.texto("Sin gastos adicionales.", MARGEN + 6, { color: SUAVE });
    h.y -= 15;
  }
  for (const g of f.gastosVenta) h.importe(g.concepto, pesos(g.importe));
  const totalGastos = f.total - op.precioVenta;
  h.linea(h.y + 9);
  h.importe("Total de gastos", pesos(totalGastos), { negrita: true });
  h.importe("Total de la operación", pesos(f.total), { negrita: true, tam: 11 });

  h.titulo("Forma de pago");
  const pagos = f.pagos.filter((x) => x.p.estado !== "DEVUELTA");
  if (pagos.length === 0) {
    h.texto("A definir.", MARGEN + 6, { color: SUAVE });
    h.y -= 15;
  }
  for (const { p, permuta } of pagos) {
    const detalle =
      p.tipo === "PERMUTA" && permuta
        ? `Toma de usado: ${permuta.marca} ${permuta.modelo} ${permuta.anio}${permuta.dominio ? ` (${permuta.dominio})` : ""}`
        : `${ETIQUETA_PAGO[p.tipo]}${p.banco ? ` · ${p.banco}` : ""} · ${fecha(p.fecha)}${p.estado === "COBRADO" ? " · recibido" : ""}`;
    h.importe(detalle, pesos(-p.importe));
  }
  h.linea(h.y + 9);
  h.importe("Saldo a cancelar", pesos(f.cobertura.faltante), { negrita: true, tam: 11 });

  if (op.entregaProgramada || op.observaciones) {
    h.titulo("Entrega y observaciones");
    if (op.entregaProgramada) {
      h.campos([
        ["Compromiso de entrega", `${fecha(diaArgentina(op.entregaProgramada))} a las ${horaArgentina(op.entregaProgramada)} hs`],
        ["Lugar", op.lugarEntrega],
      ]);
    }
    if (op.observaciones) h.parrafo(op.observaciones, { x: MARGEN + 6, ancho: ANCHO - 12 });
  }

  // Leyendas y firmas al pie.
  const leyenda = h.lineas(salon.leyenda, ANCHO, 7.5);
  let y = MARGEN + 64 + leyenda.length * 10;
  if (h.y - 20 < y) y = Math.min(y, h.y - 20);
  for (const l of leyenda) {
    h.texto(l, MARGEN, { tam: 7.5, color: SUAVE, y });
    y -= 10;
  }
  const firma = (x: number, t: string) => {
    h.page.drawLine({ start: { x, y: MARGEN + 22 }, end: { x: x + 190, y: MARGEN + 22 }, thickness: 0.7, color: TINTA });
    h.texto(t, x, { tam: 8.5, color: SUAVE, y: MARGEN + 10 });
  };
  firma(MARGEN, "Firma y aclaración del cliente");
  firma(MARGEN + ANCHO - 190, `Por ${salon.nombre}${vendedor ? ` · ${vendedor.nombre}` : ""}`);

  // ---------- Hoja 2: ficha de la unidad ----------
  const h2 = new Hoja(doc, fuentes);
  encabezado(h2, "Ficha de la unidad");
  h2.titulo("Ficha de la unidad");
  h2.campos([
    ["Marca", v.marca],
    ["Modelo", v.modelo],
    ["Versión", v.version],
    ["Año", String(v.anio)],
    ["Dominio", v.dominio],
    ["Kilómetros", v.km != null ? pesosFmt.format(v.km) : null],
    ["Color", v.color],
    ["Combustible", v.combustible],
    ["Transmisión", v.transmision],
    ["Chasis", v.chasis],
    ["Prenda", v.prendado ? `Sí${v.prendaDetalle ? ` · ${v.prendaDetalle}` : ""}` : "No"],
  ]);

  h2.titulo("Documentación");
  for (const d of papeles) {
    if (d.estado === "NO_APLICA") continue;
    h2.importe(d.nombre, d.estado === "RECIBIDO" ? "En condiciones" : "Pendiente");
  }

  h2.titulo("Compromiso de entrega");
  if (op.entregaProgramada) {
    h2.campos([
      ["Fecha", fecha(diaArgentina(op.entregaProgramada))],
      ["Hora", `${horaArgentina(op.entregaProgramada)} hs`],
      ["Lugar", op.lugarEntrega ?? salon.direccion],
    ]);
  } else {
    h2.texto("A coordinar con el cliente.", MARGEN + 6, { color: SUAVE });
    h2.y -= 15;
  }
  h2.y -= 6;
  h2.parrafo("La unidad se entrega con la documentación indicada en condiciones. Desde la fecha y hora de entrega, multas, patentes y responsabilidad civil corren por cuenta del comprador.", {
    tam: 8.5,
    color: SUAVE,
  });

  return { pdf: await doc.save(), nombre: `preventa-${f.numero}.pdf` };
}
