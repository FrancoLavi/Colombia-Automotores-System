import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import { auditar } from "@/lib/auditoria";
import { hoyIso } from "@/lib/formato";
import { costoTotal, compraEnPesos, diasEnStock, margenUsd, precioSugerido } from "@/domain/negocio";
import {
  alertasVehiculo,
  faltantesParaHabilitar,
  transicionesManuales,
  ETIQUETA_ESTADO,
  ETIQUETA_UBICACION,
  type EstadoVehiculo,
  type Ubicacion,
} from "@/domain/stock";

import { ErrorNegocio } from "./errores";
export { ErrorNegocio };

type Vehiculo = typeof s.vehiculos.$inferSelect;
const ENTIDAD = "vehiculo";

// ---------- Consultas ----------

export async function tcHoy() {
  const [ultimo] = await db.select().from(s.tiposCambio).orderBy(desc(s.tiposCambio.fecha)).limit(1);
  return ultimo ?? null;
}

async function documentosDe(ids: number[], ex: Tx | typeof db = db) {
  if (!ids.length) return [];
  return ex
    .select({
      id: s.documentosVehiculo.id,
      vehiculoId: s.documentosVehiculo.vehiculoId,
      tipoDocumentoId: s.documentosVehiculo.tipoDocumentoId,
      nombre: s.tiposDocumento.nombre,
      obligatorio: s.tiposDocumento.obligatorio,
      tieneVencimiento: s.tiposDocumento.tieneVencimiento,
      estado: s.documentosVehiculo.estado,
      fechaRecepcion: s.documentosVehiculo.fechaRecepcion,
      fechaVencimiento: s.documentosVehiculo.fechaVencimiento,
      recibidoPor: s.usuarios.nombre,
    })
    .from(s.documentosVehiculo)
    .innerJoin(s.tiposDocumento, eq(s.tiposDocumento.id, s.documentosVehiculo.tipoDocumentoId))
    .leftJoin(s.usuarios, eq(s.usuarios.id, s.documentosVehiculo.recibidoPor))
    .where(inArray(s.documentosVehiculo.vehiculoId, ids))
    .orderBy(asc(s.tiposDocumento.orden));
}

export interface FiltrosStock {
  q?: string;
  estado?: string; // "ACTIVOS" (por defecto), "TODOS" o un estado
  ubicacion?: string;
  marca?: string;
  diasMin?: number;
}

export async function listarStock(f: FiltrosStock) {
  const estado = f.estado || "ACTIVOS";
  const condiciones = [];
  if (estado === "ACTIVOS") condiciones.push(inArray(s.vehiculos.estado, ["POR_INGRESAR", "DISPONIBLE", "RESERVADO", "VENDIDO"]));
  else if (estado !== "TODOS") condiciones.push(eq(s.vehiculos.estado, estado as EstadoVehiculo));
  if (f.ubicacion) condiciones.push(eq(s.vehiculos.ubicacion, f.ubicacion as Ubicacion));
  if (f.marca) condiciones.push(eq(s.vehiculos.marca, f.marca));
  if (f.q) {
    const q = `%${f.q.trim()}%`;
    condiciones.push(
      sql`(${s.vehiculos.dominio} ilike ${q} or ${s.vehiculos.marca} ilike ${q} or ${s.vehiculos.modelo} ilike ${q} or ${s.vehiculos.version} ilike ${q})`,
    );
  }

  const filas = await db
    .select({ v: s.vehiculos, financista: s.participes.nombre })
    .from(s.vehiculos)
    .innerJoin(s.participes, eq(s.participes.id, s.vehiculos.participeId))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(asc(s.vehiculos.fechaIngreso));

  const ids = filas.map((x) => x.v.id);
  const gastos = ids.length
    ? await db
        .select({ vehiculoId: s.gastos.vehiculoId, importe: s.gastos.importe, extraordinario: s.gastos.extraordinario })
        .from(s.gastos)
        .where(inArray(s.gastos.vehiculoId, ids))
    : [];
  const docs = await documentosDe(ids);
  const tc = await tcHoy();

  const resultado = filas.map(({ v, financista }) => {
    const costo = costoTotal(v.valorCompraArs, gastos.filter((g) => g.vehiculoId === v.id));
    const precio = v.precioPublicado ?? precioSugerido(costo, v.ajustePrecio);
    const d = docs.filter((x) => x.vehiculoId === v.id);
    return {
      ...v,
      financista,
      costo,
      precio,
      dias: diasEnStock(v.fechaIngreso, v.fechaDisponible),
      margen: tc && costo > 0 ? margenUsd(precio, costo, v.tcIngreso, tc.valor).margen : null,
      alertas: alertasVehiculo({ ...v, costo, precio }, d, tc?.valor ?? null),
    };
  });

  const conteo = await db
    .select({ estado: s.vehiculos.estado, n: sql<number>`count(*)::int` })
    .from(s.vehiculos)
    .groupBy(s.vehiculos.estado);
  const marcas = await db.selectDistinct({ marca: s.vehiculos.marca }).from(s.vehiculos).orderBy(asc(s.vehiculos.marca));

  return {
    vehiculos: f.diasMin ? resultado.filter((x) => x.dias >= f.diasMin!) : resultado,
    conteo: Object.fromEntries(conteo.map((c) => [c.estado, c.n])) as Partial<Record<EstadoVehiculo, number>>,
    marcas: marcas.map((m) => m.marca),
    tc,
  };
}

export async function fichaVehiculo(id: number) {
  const v = await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) });
  if (!v) return null;
  const [financista, contactoOrigen, peritaje, docs, tc] = await Promise.all([
    db.query.participes.findFirst({ where: eq(s.participes.id, v.participeId) }),
    v.contactoOrigenId ? db.query.contactos.findFirst({ where: eq(s.contactos.id, v.contactoOrigenId) }) : null,
    db.query.peritajes.findFirst({ where: eq(s.peritajes.vehiculoId, id) }),
    documentosDe([id]),
    tcHoy(),
  ]);
  const gastos = await db
    .select({ g: s.gastos, categoria: s.categoriasGasto.nombre })
    .from(s.gastos)
    .innerJoin(s.categoriasGasto, eq(s.categoriasGasto.id, s.gastos.categoriaId))
    .where(eq(s.gastos.vehiculoId, id))
    .orderBy(asc(s.gastos.fecha), asc(s.gastos.id));
  const archivos = await db.select().from(s.archivos).where(eq(s.archivos.vehiculoId, id)).orderBy(asc(s.archivos.id));
  const historial = await db
    .select({ a: s.auditoria, usuario: s.usuarios.nombre })
    .from(s.auditoria)
    .leftJoin(s.usuarios, eq(s.usuarios.id, s.auditoria.usuarioId))
    .where(and(eq(s.auditoria.entidad, ENTIDAD), eq(s.auditoria.entidadId, id)))
    .orderBy(desc(s.auditoria.fecha), desc(s.auditoria.id))
    .limit(50);

  const costo = costoTotal(v.valorCompraArs, gastos.map((x) => x.g));
  const sugerido = precioSugerido(costo, v.ajustePrecio);
  const precio = v.precioPublicado ?? sugerido;
  return {
    v,
    financista,
    contactoOrigen,
    peritaje,
    documentos: docs,
    gastos,
    archivos,
    historial,
    tc,
    costo,
    costoUsd: v.tcIngreso > 0 ? costo / v.tcIngreso : 0,
    sugerido,
    precio,
    margen: tc && costo > 0 ? margenUsd(precio, costo, v.tcIngreso, tc.valor) : null,
    dias: diasEnStock(v.fechaIngreso, v.fechaDisponible),
    faltantes: faltantesParaHabilitar(v.estado, docs, peritaje ?? null),
    transiciones: transicionesManuales(v.estado),
    alertas: alertasVehiculo({ ...v, costo, precio }, docs, tc?.valor ?? null),
  };
}

export async function marcasUsadas() {
  const r = await db.selectDistinct({ marca: s.vehiculos.marca }).from(s.vehiculos).orderBy(asc(s.vehiculos.marca));
  return r.map((x) => x.marca);
}

export async function datosFormulario() {
  const [participes, categorias, contactos] = await Promise.all([
    db.select().from(s.participes).where(eq(s.participes.activo, true)).orderBy(asc(s.participes.id)),
    db.select().from(s.categoriasGasto).where(eq(s.categoriasGasto.activo, true)).orderBy(asc(s.categoriasGasto.orden)),
    db.select({ id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido }).from(s.contactos).orderBy(asc(s.contactos.nombre)),
  ]);
  return { participes, categorias, contactos };
}

// ---------- Altas y modificaciones ----------

export interface DatosVehiculo {
  dominio: string | null;
  chasis: string | null;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  km: number | null;
  color: string | null;
  combustible: string | null;
  transmision: string | null;
  tipoIngreso: "COMPRA" | "PERMUTA" | "CONSIGNACION";
  participeId: number;
  ingresadoPor: string | null;
  contactoOrigenId: number | null;
  fechaIngreso: string;
  monedaCompra: "ARS" | "USD";
  valorCompra: number;
  tcIngreso: number;
  ubicacion: Ubicacion;
  observaciones: string | null;
}

async function verificarDominio(tx: Tx, dominio: string | null, excluirId?: number) {
  if (!dominio) return;
  const otro = await tx.query.vehiculos.findFirst({ where: eq(s.vehiculos.dominio, dominio) });
  if (otro && otro.id !== excluirId) throw new ErrorNegocio(`Ya existe un auto con la patente ${dominio}`);
}

async function financistaValido(tx: Tx, d: Pick<DatosVehiculo, "tipoIngreso" | "participeId">) {
  // En consignación la ganancia es 100 % del salón: el financista es siempre el salón.
  if (d.tipoIngreso !== "CONSIGNACION") return d.participeId;
  const salon = await tx.query.participes.findFirst({ where: eq(s.participes.tipo, "SALON") });
  if (!salon) throw new ErrorNegocio("No está configurado el participe Salón");
  return salon.id;
}

function camposVehiculo(d: DatosVehiculo) {
  const compra = compraEnPesos(d.valorCompra, d.monedaCompra, d.tcIngreso);
  return {
    dominio: d.dominio,
    chasis: d.chasis,
    marca: d.marca,
    modelo: d.modelo,
    version: d.version,
    anio: d.anio,
    km: d.km,
    color: d.color,
    combustible: d.combustible,
    transmision: d.transmision,
    tipoIngreso: d.tipoIngreso,
    ingresadoPor: d.ingresadoPor,
    contactoOrigenId: d.contactoOrigenId,
    fechaIngreso: d.fechaIngreso,
    monedaCompra: d.monedaCompra,
    valorCompraUsd: d.monedaCompra === "USD" ? compra.usd : null,
    valorCompraArs: compra.ars,
    tcIngreso: d.tcIngreso,
    ubicacion: d.ubicacion,
    observaciones: d.observaciones,
  };
}

export type PagoCompra =
  | { modo: "PAGADO"; medio: "EFECTIVO" | "BANCO" }
  | { modo: "A_PAGAR"; vencimiento: string | null }
  | { modo: "SIN_REGISTRO" };

export async function crearVehiculo(usuarioId: number, d: DatosVehiculo, pago: PagoCompra, tx?: Tx): Promise<number> {
  const run = async (t: Tx) => {
    await verificarDominio(t, d.dominio);
    const participeId = await financistaValido(t, d);
    const [v] = await t
      .insert(s.vehiculos)
      .values({ ...camposVehiculo(d), participeId, estado: "POR_INGRESAR" })
      .returning();

    const tipos = await t.select().from(s.tiposDocumento).where(eq(s.tiposDocumento.activo, true));
    if (tipos.length) {
      await t.insert(s.documentosVehiculo).values(tipos.map((tp) => ({ vehiculoId: v.id, tipoDocumentoId: tp.id })));
    }

    // Pago de la compra (solo COMPRA; la permuta no pasa por caja y la consignación se paga al vender).
    if (d.tipoIngreso === "COMPRA" && v.valorCompraArs > 0) {
      const etiqueta = `${v.marca} ${v.modelo}${v.dominio ? ` ${v.dominio}` : ""}`;
      if (pago.modo === "PAGADO") {
        await t.insert(s.movimientosCaja).values({
          sentido: "EGRESO",
          medio: pago.medio,
          categoria: "PAGO_COMPRA",
          importe: v.valorCompraArs,
          concepto: `Compra ${etiqueta}`,
          vehiculoId: v.id,
          participeId,
          usuarioId,
        });
      } else if (pago.modo === "A_PAGAR") {
        const contacto = d.contactoOrigenId ? await t.query.contactos.findFirst({ where: eq(s.contactos.id, d.contactoOrigenId) }) : null;
        await t.insert(s.cuentasPendientes).values({
          tipo: "A_PAGAR",
          origen: "SALDO_COMPRA",
          contraparte: contacto ? `${contacto.nombre} ${contacto.apellido ?? ""}`.trim() : "Vendedor",
          contactoId: d.contactoOrigenId,
          vehiculoId: v.id,
          importe: v.valorCompraArs,
          saldo: v.valorCompraArs,
          vencimiento: pago.vencimiento,
          notas: `Compra ${etiqueta}`,
        });
      }
    }
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: v.id, accion: "CREAR", despues: v, descripcion: `Alta del auto (${d.tipoIngreso.toLowerCase()})` });
    return v.id;
  };
  return tx ? run(tx) : db.transaction(run);
}

export async function actualizarVehiculo(usuarioId: number, id: number, d: DatosVehiculo) {
  await db.transaction(async (t) => {
    const antes = await t.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) });
    if (!antes) throw new ErrorNegocio("El auto no existe");
    await verificarDominio(t, d.dominio, id);
    const participeId = await financistaValido(t, d);
    const [despues] = await t.update(s.vehiculos).set({ ...camposVehiculo(d), participeId }).where(eq(s.vehiculos.id, id)).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes, despues, descripcion: "Datos del auto editados" });
  });
}

async function cargar(t: Tx, id: number): Promise<Vehiculo> {
  const v = await t.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) });
  if (!v) throw new ErrorNegocio("El auto no existe");
  return v;
}

export async function cambiarUbicacion(usuarioId: number, id: number, ubicacion: Ubicacion) {
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    if (v.ubicacion === ubicacion) return;
    await t.update(s.vehiculos).set({ ubicacion }).where(eq(s.vehiculos.id, id));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR",
      antes: { ubicacion: v.ubicacion }, despues: { ubicacion },
      descripcion: `Ubicación: ${ETIQUETA_UBICACION[v.ubicacion]} → ${ETIQUETA_UBICACION[ubicacion]}`,
    });
  });
}

export async function cambiarEstadoManual(usuarioId: number, id: number, estado: EstadoVehiculo, motivo: string | null) {
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    if (!transicionesManuales(v.estado).includes(estado)) {
      throw new ErrorNegocio(`No se puede pasar de ${ETIQUETA_ESTADO[v.estado]} a ${ETIQUETA_ESTADO[estado]} desde la ficha`);
    }
    await t.update(s.vehiculos).set({ estado }).where(eq(s.vehiculos.id, id));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO",
      antes: { estado: v.estado }, despues: { estado },
      descripcion: `Estado: ${ETIQUETA_ESTADO[v.estado]} → ${ETIQUETA_ESTADO[estado]}${motivo ? ` (${motivo})` : ""}`,
    });
  });
}

export async function habilitarVenta(usuarioId: number, id: number) {
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    const docs = await documentosDe([id], t);
    const peritaje = await t.query.peritajes.findFirst({ where: eq(s.peritajes.vehiculoId, id) });
    const faltan = faltantesParaHabilitar(v.estado, docs, peritaje ?? null);
    if (faltan.length) throw new ErrorNegocio(faltan.join(" · "));
    const fechaDisponible = hoyIso();
    await t.update(s.vehiculos).set({ estado: "DISPONIBLE", fechaDisponible }).where(eq(s.vehiculos.id, id));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO",
      antes: { estado: v.estado }, despues: { estado: "DISPONIBLE", fechaDisponible },
      descripcion: "Habilitado para la venta",
    });
  });
}

export async function actualizarPrecio(usuarioId: number, id: number, ajustePrecio: number, precioPublicado: number | null) {
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    await t.update(s.vehiculos).set({ ajustePrecio, precioPublicado }).where(eq(s.vehiculos.id, id));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR",
      antes: { ajustePrecio: v.ajustePrecio, precioPublicado: v.precioPublicado },
      despues: { ajustePrecio, precioPublicado },
      descripcion: "Precio actualizado",
    });
  });
}

// ---------- Papeles y peritaje ----------

export async function registrarDocumento(
  usuarioId: number,
  vehiculoId: number,
  documentoId: number,
  estado: "PENDIENTE" | "RECIBIDO" | "NO_APLICA",
  fechaVencimiento: string | null,
) {
  await db.transaction(async (t) => {
    const antes = await t.query.documentosVehiculo.findFirst({
      where: and(eq(s.documentosVehiculo.id, documentoId), eq(s.documentosVehiculo.vehiculoId, vehiculoId)),
    });
    if (!antes) throw new ErrorNegocio("El papel no existe");
    const tipo = await t.query.tiposDocumento.findFirst({ where: eq(s.tiposDocumento.id, antes.tipoDocumentoId) });
    const recibido = estado === "RECIBIDO";
    const cambios = {
      estado,
      fechaVencimiento,
      fechaRecepcion: recibido ? (antes.estado === "RECIBIDO" ? antes.fechaRecepcion : hoyIso()) : null,
      recibidoPor: recibido ? (antes.estado === "RECIBIDO" ? antes.recibidoPor : usuarioId) : null,
    };
    await t.update(s.documentosVehiculo).set(cambios).where(eq(s.documentosVehiculo.id, documentoId));
    const texto = { PENDIENTE: "marcado pendiente", RECIBIDO: "recibido", NO_APLICA: "no aplica" }[estado];
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: "MODIFICAR",
      antes: { estado: antes.estado, fechaVencimiento: antes.fechaVencimiento },
      despues: { estado, fechaVencimiento },
      descripcion: `Papel "${tipo?.nombre}": ${texto}`,
    });
  });
}

export async function guardarPeritaje(
  usuarioId: number,
  vehiculoId: number,
  p: { fecha: string; perito: string | null; resultado: "APTO" | "APTO_CON_OBS" | "NO_APTO"; reparacionEstimada: number | null; observaciones: string | null },
) {
  await db.transaction(async (t) => {
    await cargar(t, vehiculoId);
    const antes = await t.query.peritajes.findFirst({ where: eq(s.peritajes.vehiculoId, vehiculoId) });
    if (antes) await t.update(s.peritajes).set(p).where(eq(s.peritajes.id, antes.id));
    else await t.insert(s.peritajes).values({ ...p, vehiculoId, creadoPor: usuarioId });
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: antes ? "MODIFICAR" : "CREAR",
      antes: antes ? { resultado: antes.resultado, observaciones: antes.observaciones } : null,
      despues: { resultado: p.resultado, observaciones: p.observaciones },
      descripcion: `Peritaje ${antes ? "modificado" : "cargado"}: ${p.resultado.replaceAll("_", " ").toLowerCase()}`,
    });
  });
}

// ---------- Gastos ----------

export async function agregarGasto(
  usuarioId: number,
  vehiculoId: number,
  g: { categoriaId: number; fecha: string; descripcion: string | null; importe: number; estado: "PAGADO" | "PENDIENTE"; medio: "EFECTIVO" | "BANCO" },
) {
  if (g.importe <= 0) throw new ErrorNegocio("El importe debe ser mayor a cero");
  await db.transaction(async (t) => {
    const v = await cargar(t, vehiculoId);
    const categoria = await t.query.categoriasGasto.findFirst({ where: eq(s.categoriasGasto.id, g.categoriaId) });
    if (!categoria) throw new ErrorNegocio("Categoría inválida");
    // R6: un gasto que aparece con el auto ya vendido lo asume el salón y no suma al costo.
    const extraordinario = v.estado === "VENDIDO" || v.estado === "ENTREGADO";
    const etiqueta = `${categoria.nombre} · ${v.marca} ${v.modelo}${v.dominio ? ` ${v.dominio}` : ""}`;

    let movimientoId: number | null = null;
    let cuentaPendienteId: number | null = null;
    if (g.estado === "PAGADO") {
      const [m] = await t
        .insert(s.movimientosCaja)
        .values({
          sentido: "EGRESO",
          medio: g.medio,
          categoria: extraordinario ? "GASTO_EXTRAORDINARIO" : "GASTO_VEHICULO",
          importe: g.importe,
          concepto: g.descripcion ? `${etiqueta} (${g.descripcion})` : etiqueta,
          vehiculoId,
          usuarioId,
        })
        .returning();
      movimientoId = m.id;
    } else {
      const [c] = await t
        .insert(s.cuentasPendientes)
        .values({ tipo: "A_PAGAR", origen: "GASTO", contraparte: g.descripcion || categoria.nombre, vehiculoId, importe: g.importe, saldo: g.importe, notas: etiqueta })
        .returning();
      cuentaPendienteId = c.id;
    }
    const [gasto] = await t
      .insert(s.gastos)
      .values({ ...g, vehiculoId, extraordinario, movimientoId, cuentaPendienteId, creadoPor: usuarioId })
      .returning();
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: "CREAR", despues: gasto,
      descripcion: `Gasto ${categoria.nombre} $ ${g.importe.toLocaleString("es-AR")}${extraordinario ? " (extraordinario del salón)" : ""}${g.estado === "PENDIENTE" ? " — a pagar" : ""}`,
    });
  });
}

export async function eliminarGasto(usuarioId: number, vehiculoId: number, gastoId: number) {
  await db.transaction(async (t) => {
    const gasto = await t.query.gastos.findFirst({ where: and(eq(s.gastos.id, gastoId), eq(s.gastos.vehiculoId, vehiculoId)) });
    if (!gasto) throw new ErrorNegocio("El gasto no existe");
    if (gasto.cuentaPendienteId) {
      const c = await t.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, gasto.cuentaPendienteId) });
      if (c && c.saldo !== c.importe) throw new ErrorNegocio("El gasto ya tiene pagos parciales: anulalos desde Caja primero");
    }
    await t.delete(s.gastos).where(eq(s.gastos.id, gastoId));
    if (gasto.movimientoId) {
      await t.update(s.movimientosCaja).set({ anulado: true, motivoAnulacion: "Gasto eliminado" }).where(eq(s.movimientosCaja.id, gasto.movimientoId));
    }
    if (gasto.cuentaPendienteId) await t.delete(s.cuentasPendientes).where(eq(s.cuentasPendientes.id, gasto.cuentaPendienteId));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: "ELIMINAR", antes: gasto,
      descripcion: `Gasto eliminado: $ ${gasto.importe.toLocaleString("es-AR")}`,
    });
  });
}

// ---------- Archivos ----------

export async function registrarArchivo(
  usuarioId: number,
  vehiculoId: number,
  a: { tipo: "FOTO_PERITAJE" | "DOCUMENTO" | "OTRO"; url: string; nombre: string | null },
) {
  await db.transaction(async (t) => {
    await cargar(t, vehiculoId);
    const [arch] = await t.insert(s.archivos).values({ ...a, vehiculoId, creadoPor: usuarioId }).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: "CREAR", despues: arch, descripcion: `Archivo agregado: ${a.nombre ?? a.tipo}` });
  });
}

export async function quitarArchivo(usuarioId: number, vehiculoId: number, archivoId: number) {
  return db.transaction(async (t) => {
    const arch = await t.query.archivos.findFirst({ where: and(eq(s.archivos.id, archivoId), eq(s.archivos.vehiculoId, vehiculoId)) });
    if (!arch) throw new ErrorNegocio("El archivo no existe");
    await t.delete(s.archivos).where(eq(s.archivos.id, archivoId));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: "ELIMINAR", antes: arch, descripcion: `Archivo quitado: ${arch.nombre ?? arch.tipo}` });
    return arch.url;
  });
}

// ---------- Tipo de cambio ----------

export async function guardarTipoCambio(usuarioId: number, fecha: string, valor: number) {
  if (valor <= 0) throw new ErrorNegocio("El dólar debe ser mayor a cero");
  await db
    .insert(s.tiposCambio)
    .values({ fecha, valor, usuarioId })
    .onConflictDoUpdate({ target: s.tiposCambio.fecha, set: { valor, usuarioId } });
}
