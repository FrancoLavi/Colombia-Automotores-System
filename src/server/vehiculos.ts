import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import { auditar } from "@/lib/auditoria";
import { hoyIso } from "@/lib/formato";
import { costoTotal, compraEnPesos, diasEnStock, margenUsd, precioSugerido, r2 } from "@/domain/negocio";
import { capitalDelInversor, compraSaleDeCaja, efectoCambioFinancista, gastosDelDueno, type PagadorGasto } from "@/domain/caja";
import { coincideAuto, opcionesAuto } from "@/domain/autos";
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
import { exigirFondos, fotoFondos } from "./fondos";
import { obtenerParametros } from "./parametros";
import { dolarDeHoy } from "./dolar";
export { ErrorNegocio };

type Vehiculo = typeof s.vehiculos.$inferSelect;
const ENTIDAD = "vehiculo";

// ---------- Consultas ----------

/** Dólar blue de hoy (lo trae de internet si todavía no está cargado; si no hay conexión, el último conocido). */
export async function tcHoy() {
  return dolarDeHoy();
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
      archivoUrl: s.documentosVehiculo.archivoUrl,
      soloPrendados: s.tiposDocumento.soloPrendados,
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
  modelo?: string;
  patente?: string;
  diasMin?: number;
}

export async function listarStock(f: FiltrosStock) {
  const estado = f.estado || "ACTIVOS";
  const condiciones = [];
  if (estado === "ACTIVOS") condiciones.push(inArray(s.vehiculos.estado, ["POR_INGRESAR", "DISPONIBLE", "RESERVADO", "VENDIDO"]));
  else if (estado !== "TODOS") condiciones.push(eq(s.vehiculos.estado, estado as EstadoVehiculo));
  if (f.ubicacion) condiciones.push(eq(s.vehiculos.ubicacion, f.ubicacion as Ubicacion));
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
  const p = await obtenerParametros();

  const resultado = filas.map(({ v, financista }) => {
    const costo = costoTotal(v.valorCompraArs, gastos.filter((g) => g.vehiculoId === v.id));
    const precio = v.precioPublicado ?? precioSugerido(costo, v.ajustePrecio, p.margenBase);
    const d = docs.filter((x) => x.vehiculoId === v.id);
    return {
      ...v,
      financista,
      costo,
      precio,
      dias: diasEnStock(v.fechaIngreso, v.fechaDisponible),
      margen: tc && costo > 0 ? margenUsd(precio, costo, v.tcIngreso, tc.valor).margen : null,
      alertas: alertasVehiculo({ ...v, costo, precio }, d, tc?.valor ?? null, p),
    };
  });

  const conteo = await db
    .select({ estado: s.vehiculos.estado, n: sql<number>`count(*)::int` })
    .from(s.vehiculos)
    .groupBy(s.vehiculos.estado);
  const todos = await db.selectDistinct({ marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, dominio: s.vehiculos.dominio }).from(s.vehiculos);
  const { marcas, modelos } = opcionesAuto(todos);

  return {
    vehiculos: resultado.filter((x) => (!f.diasMin || x.dias >= f.diasMin) && coincideAuto(x, f)),
    conteo: Object.fromEntries(conteo.map((c) => [c.estado, c.n])) as Partial<Record<EstadoVehiculo, number>>,
    marcas,
    modelos,
    tc,
  };
}

export async function fichaVehiculo(id: number) {
  const v = await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) });
  if (!v) return null;
  const [financista, contactoOrigen, peritaje, docs, tc, p] = await Promise.all([
    db.query.participes.findFirst({ where: eq(s.participes.id, v.participeId) }),
    v.contactoOrigenId ? db.query.contactos.findFirst({ where: eq(s.contactos.id, v.contactoOrigenId) }) : null,
    db.query.peritajes.findFirst({ where: eq(s.peritajes.vehiculoId, id) }),
    documentosDe([id]),
    tcHoy(),
    obtenerParametros(),
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
  const dueno = await nombreDelDueno(db, v);
  const puesto = financista ? await puestoEnElAuto(db, v, financista.tipo) : null;
  const sugerido = precioSugerido(costo, v.ajustePrecio, p.margenBase);
  const precio = v.precioPublicado ?? sugerido;
  return {
    v,
    financista,
    /** R8: quién, además del salón, puede pagar un gasto (el inversor o el consignante). */
    dueno,
    /** K15: lo que tiene puesto hoy el que lo financia (para avisar qué pasa si se cambia). */
    puesto,
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
    margen: tc && costo > 0 ? margenUsd(precio, costo, v.tcIngreso, tc.valor, p.umbralMargenUsd) : null,
    margenBase: p.margenBase,
    dias: diasEnStock(v.fechaIngreso, v.fechaDisponible),
    faltantes: faltantesParaHabilitar(v.estado, docs, peritaje ?? null),
    transiciones: transicionesManuales(v.estado),
    alertas: alertasVehiculo({ ...v, costo, precio }, docs, tc?.valor ?? null, p),
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
  /** Auto con prenda: pide además la cancelación de prenda para habilitarlo. */
  prendado?: boolean;
  prendaDetalle?: string | null;
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
    prendado: d.prendado ?? false,
    prendaDetalle: d.prendado ? (d.prendaDetalle ?? null) : null,
  };
}

/** Deja los papeles del auto acordes a si está prendado: agrega los que faltan y saca los de prenda pendientes si ya no aplica. */
async function sincronizarPapeles(t: Tx, vehiculoId: number, prendado: boolean) {
  const tipos = await t.select().from(s.tiposDocumento).where(eq(s.tiposDocumento.activo, true));
  const corresponden = tipos.filter((tp) => prendado || !tp.soloPrendados);
  if (corresponden.length) {
    await t
      .insert(s.documentosVehiculo)
      .values(corresponden.map((tp) => ({ vehiculoId, tipoDocumentoId: tp.id })))
      .onConflictDoNothing();
  }
  const dePrenda = tipos.filter((tp) => tp.soloPrendados).map((tp) => tp.id);
  if (!prendado && dePrenda.length) {
    await t
      .delete(s.documentosVehiculo)
      .where(
        and(
          eq(s.documentosVehiculo.vehiculoId, vehiculoId),
          inArray(s.documentosVehiculo.tipoDocumentoId, dePrenda),
          eq(s.documentosVehiculo.estado, "PENDIENTE"),
        ),
      );
  }
}

export type PagoCompra =
  | { modo: "PAGADO"; medio: "EFECTIVO" | "BANCO" }
  | { modo: "A_PAGAR"; vencimiento: string | null }
  | { modo: "SIN_REGISTRO" };

export async function crearVehiculo(usuarioId: number, d: DatosVehiculo, pago: PagoCompra, tx?: Tx): Promise<number> {
  const run = async (t: Tx) => {
    const antesFondos = await fotoFondos(t); // K13: para comparar al final
    await verificarDominio(t, d.dominio);
    const participeId = await financistaValido(t, d);
    const [v] = await t
      .insert(s.vehiculos)
      .values({ ...camposVehiculo(d), participeId, estado: "POR_INGRESAR" })
      .returning();

    await sincronizarPapeles(t, v.id, v.prendado);

    // K9: la compra la paga el salón solo si el auto es suyo. El de un inversor lo paga él
    // directo al vendedor, así que no toca la caja ni queda como deuda del salón. La permuta no
    // se paga y la consignación se le paga al dueño recién cuando se vende.
    const financista = (await t.query.participes.findFirst({ where: eq(s.participes.id, participeId) }))!;
    if (v.valorCompraArs > 0 && compraSaleDeCaja({ tipoIngreso: d.tipoIngreso, financista: financista.tipo })) {
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
        await exigirFondos(t, antesFondos);
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

/** K15: cómo se registra un cambio de quién financia. */
export type CambioFinancia = { modo: "PASE"; medio: "EFECTIVO" | "BANCO" } | { modo: "CORRECCION" };

const EN_STOCK: EstadoVehiculo[] = ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"];

/** Lo que el salón todavía le debe al vendedor por la compra de este auto. */
async function saldoCompraPendiente(t: Tx | typeof db, vehiculoId: number) {
  const [c] = await t
    .select({ total: sql<number>`coalesce(sum(${s.cuentasPendientes.saldo}), 0)::float` })
    .from(s.cuentasPendientes)
    .where(and(eq(s.cuentasPendientes.vehiculoId, vehiculoId), eq(s.cuentasPendientes.origen, "SALDO_COMPRA"), eq(s.cuentasPendientes.estado, "ABIERTA")));
  return c.total;
}

/**
 * K15: lo que tiene puesto hoy en el auto el que lo financia, y si un cambio de financista mueve
 * la caja (una permuta cuya venta sigue abierta la resuelve el cierre, K12).
 */
export async function puestoEnElAuto(t: Tx | typeof db, v: Vehiculo, financista: "SALON" | "INVERSOR") {
  const gastos = await t
    .select({ importe: s.gastos.importe, extraordinario: s.gastos.extraordinario, pagadoPor: s.gastos.pagadoPor })
    .from(s.gastos)
    .where(eq(s.gastos.vehiculoId, v.id));
  const op = v.tipoIngreso === "PERMUTA" && v.operacionOrigenId ? await t.query.operaciones.findFirst({ where: eq(s.operaciones.id, v.operacionOrigenId) }) : null;
  const permutaPendiente = !!op && !["CERRADA", "ENTREGADA"].includes(op.estado);
  const saldoCompra = await saldoCompraPendiente(t, v.id);
  const deDueno = gastosDelDueno(gastos);
  const puesto =
    financista === "SALON"
      ? r2(v.valorCompraArs - saldoCompra)
      : capitalDelInversor({ tipoIngreso: v.tipoIngreso, financista, valorCompraArs: v.valorCompraArs, gastosDelDueno: deDueno });
  return { puesto, permutaPendiente, saldoCompra, gastosDelDueno: deDueno };
}

export async function actualizarVehiculo(usuarioId: number, id: number, d: DatosVehiculo, cambio: CambioFinancia = { modo: "CORRECCION" }) {
  await db.transaction(async (t) => {
    const antesFondos = await fotoFondos(t); // K13: para comparar al final
    const antes = await t.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, id) });
    if (!antes) throw new ErrorNegocio("El auto no existe");
    await verificarDominio(t, d.dominio, id);
    const participeId = await financistaValido(t, d);
    const cambiaFinancista = participeId !== antes.participeId && antes.tipoIngreso !== "CONSIGNACION" && d.tipoIngreso !== "CONSIGNACION";
    const detalleCambio = cambiaFinancista ? await registrarCambioFinancista(t, usuarioId, antes, participeId, cambio) : "";
    const [despues] = await t.update(s.vehiculos).set({ ...camposVehiculo(d), participeId }).where(eq(s.vehiculos.id, id)).returning();
    if (despues.prendado !== antes.prendado) await sincronizarPapeles(t, id, despues.prendado);
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes, despues,
      descripcion: detalleCambio ? `Datos del auto editados · ${detalleCambio}` : "Datos del auto editados",
    });
    await exigirFondos(t, antesFondos);
  });
}

/**
 * K15: el nuevo financista le devuelve al anterior lo que tenía puesto, y la caja del salón lo
 * refleja. Devuelve una línea para el historial del auto.
 */
async function registrarCambioFinancista(t: Tx, usuarioId: number, v: Vehiculo, nuevoId: number, cambio: CambioFinancia) {
  if (!EN_STOCK.includes(v.estado)) {
    throw new ErrorNegocio("El auto ya no está en stock: el reparto de su venta quedó cerrado y no se puede cambiar quién lo financia (R6).");
  }
  const [de, a] = await Promise.all([
    t.query.participes.findFirst({ where: eq(s.participes.id, v.participeId) }),
    t.query.participes.findFirst({ where: eq(s.participes.id, nuevoId) }),
  ]);
  if (!de || !a) throw new ErrorNegocio("Financista inválido");
  const { puesto, permutaPendiente, saldoCompra, gastosDelDueno: gastosDueno } = await puestoEnElAuto(t, v, de.tipo);
  const efecto = efectoCambioFinancista({ de: de.tipo, a: a.tipo, puesto, permutaPendiente, correccion: cambio.modo === "CORRECCION" });
  const etiqueta = `${v.marca} ${v.modelo}${v.dominio ? ` ${v.dominio}` : ""}`;
  const resumen = `financia ${de.nombre} → ${a.nombre}`;

  if (efecto && cambio.modo === "PASE") {
    const inversor = de.tipo === "INVERSOR" ? de : a;
    await t.insert(s.movimientosCaja).values({
      sentido: efecto.sentido,
      medio: cambio.medio,
      // Es el auto que pasa de manos: no es ganancia ni gasto de nadie, ni la devolución de una venta.
      categoria: "CAMBIO_FINANCISTA",
      importe: efecto.importe,
      concepto:
        efecto.sentido === "INGRESO"
          ? `${inversor.nombre} se queda con el ${etiqueta}: le devuelve al salón lo que había puesto`
          : `El salón se queda con el ${etiqueta}: le devuelve a ${inversor.nombre} lo que había puesto`,
      vehiculoId: v.id,
      participeId: inversor.id,
      usuarioId,
    });
  }
  // Lo que el salón todavía le debía al vendedor ahora lo paga el inversor directo (K9).
  if (cambio.modo === "PASE" && !permutaPendiente && de.tipo === "SALON" && a.tipo === "INVERSOR" && saldoCompra > 0) {
    await t
      .update(s.cuentasPendientes)
      // El importe queda en lo que el salón llegó a pagar, así el saldo da cero también hacia atrás (HU-8.1).
      .set({ importe: sql`${s.cuentasPendientes.importe} - ${s.cuentasPendientes.saldo}`, saldo: 0, estado: "CANCELADA", notas: sql`coalesce(${s.cuentasPendientes.notas}, '') || ${` · Lo paga ${a.nombre} (cambio de financista)`}` })
      .where(and(eq(s.cuentasPendientes.vehiculoId, v.id), eq(s.cuentasPendientes.origen, "SALDO_COMPRA"), eq(s.cuentasPendientes.estado, "ABIERTA")));
  }
  // Si ahora es del salón, lo que el inversor había puesto en gastos ya se lo devolvió el salón
  // (o era un error de carga): esos gastos pasan a ser del salón (R8).
  if (a.tipo === "SALON" && gastosDueno > 0) {
    await t.update(s.gastos).set({ pagadoPor: "SALON" }).where(and(eq(s.gastos.vehiculoId, v.id), eq(s.gastos.pagadoPor, "DUENO")));
  }
  if (cambio.modo === "CORRECCION") return `${resumen} (corrección de carga, sin mover la caja)`;
  if (!efecto) {
    if (permutaPendiente) return `${resumen} (se resuelve al cerrar la venta que trajo la permuta)`;
    return `${resumen} (sin pasar por la caja)`;
  }
  const medio = cambio.medio === "EFECTIVO" ? "efectivo" : "banco";
  return `${resumen}: ${efecto.sentido === "INGRESO" ? "entraron" : "salieron"} $ ${efecto.importe.toLocaleString("es-AR")} por ${medio}`;
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

/** Foto o PDF que certifica un papel recibido (opcional). Reemplaza al anterior y devuelve la clave del que se sacó. */
export async function adjuntarComprobante(
  usuarioId: number,
  vehiculoId: number,
  documentoId: number,
  a: { url: string; nombre: string | null } | null,
): Promise<string | null> {
  return db.transaction(async (t) => {
    const doc = await t.query.documentosVehiculo.findFirst({
      where: and(eq(s.documentosVehiculo.id, documentoId), eq(s.documentosVehiculo.vehiculoId, vehiculoId)),
    });
    if (!doc) throw new ErrorNegocio("El papel no existe");
    if (a && doc.estado !== "RECIBIDO") throw new ErrorNegocio("Marcá el papel como recibido antes de adjuntar el comprobante");
    const tipo = await t.query.tiposDocumento.findFirst({ where: eq(s.tiposDocumento.id, doc.tipoDocumentoId) });
    let claveAnterior: string | null = null;
    const anteriorId = Number(doc.archivoUrl?.split("/").pop());
    if (anteriorId) {
      const [borrado] = await t.delete(s.archivos).where(eq(s.archivos.id, anteriorId)).returning();
      claveAnterior = borrado?.url ?? null;
    }
    let archivoUrl: string | null = null;
    if (a) {
      const [arch] = await t.insert(s.archivos).values({ tipo: "DOCUMENTO", url: a.url, nombre: a.nombre, vehiculoId, creadoPor: usuarioId }).returning();
      archivoUrl = `/api/archivos/${arch.id}`;
    }
    await t.update(s.documentosVehiculo).set({ archivoUrl }).where(eq(s.documentosVehiculo.id, documentoId));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: a ? "CREAR" : "ELIMINAR",
      antes: { archivoUrl: doc.archivoUrl }, despues: { archivoUrl },
      descripcion: `Papel "${tipo?.nombre}": comprobante ${a ? "adjuntado" : "quitado"}`,
    });
    return claveAnterior;
  });
}

export async function guardarPeritaje(
  usuarioId: number,
  vehiculoId: number,
  p: { fecha: string; perito: string | null; resultado: "APTO" | "APTO_CON_OBS" | "NO_APTO"; reparacionEstimada: number | null; observaciones: string | null },
  /** Lo que costó el peritaje: se carga como gasto del auto (suma al costo real y al precio sugerido). */
  costo: { importe: number | null; estado: "PAGADO" | "PENDIENTE"; medio: "EFECTIVO" | "BANCO" } = { importe: null, estado: "PAGADO", medio: "EFECTIVO" },
) {
  if (costo.importe != null && costo.importe < 0) throw new ErrorNegocio("El costo del peritaje no puede ser negativo");
  await db.transaction(async (t) => {
    const v = await cargar(t, vehiculoId);
    const antes = await t.query.peritajes.findFirst({ where: eq(s.peritajes.vehiculoId, vehiculoId) });
    const importe = costo.importe || null;
    let gastoId = antes?.gastoId ?? null;
    const gastoAnterior = gastoId ? await t.query.gastos.findFirst({ where: eq(s.gastos.id, gastoId) }) : null;
    if ((gastoAnterior?.importe ?? null) !== importe) {
      if (gastoAnterior) await borrarGasto(t, usuarioId, gastoAnterior);
      gastoId = null;
      if (importe) {
        const categoriaId = await categoriaPeritaje(t);
        const g = await insertarGasto(t, usuarioId, v, { categoriaId, fecha: p.fecha, descripcion: p.perito, importe, estado: costo.estado, medio: costo.medio });
        gastoId = g.id;
      }
    }
    const datos = { ...p, costo: importe, gastoId };
    if (antes) await t.update(s.peritajes).set(datos).where(eq(s.peritajes.id, antes.id));
    else await t.insert(s.peritajes).values({ ...datos, vehiculoId, creadoPor: usuarioId });
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: antes ? "MODIFICAR" : "CREAR",
      antes: antes ? { resultado: antes.resultado, observaciones: antes.observaciones } : null,
      despues: { resultado: p.resultado, observaciones: p.observaciones },
      descripcion: `Peritaje ${antes ? "modificado" : "cargado"}: ${p.resultado.replaceAll("_", " ").toLowerCase()}`,
    });
  });
}

// ---------- Gastos ----------

/**
 * R8: quién es el dueño del auto que puede pagar un gasto de su bolsillo: el inversor que lo
 * financia o, en consignación, el cliente que lo dejó. Si es del salón, null.
 */
async function nombreDelDueno(t: Tx | typeof db, v: Vehiculo): Promise<string | null> {
  if (v.tipoIngreso === "CONSIGNACION") {
    const c = v.contactoOrigenId ? await t.query.contactos.findFirst({ where: eq(s.contactos.id, v.contactoOrigenId) }) : null;
    return c ? `${c.nombre} ${c.apellido ?? ""}`.trim() : "El dueño";
  }
  const f = await t.query.participes.findFirst({ where: eq(s.participes.id, v.participeId) });
  return f?.tipo === "INVERSOR" ? f.nombre : null;
}

export async function agregarGasto(
  usuarioId: number,
  vehiculoId: number,
  g: DatosGasto,
) {
  if (g.importe <= 0) throw new ErrorNegocio("El importe debe ser mayor a cero");
  await db.transaction(async (t) => {
    await insertarGasto(t, usuarioId, await cargar(t, vehiculoId), g);
  });
}

async function categoriaPeritaje(t: Tx) {
  const c = await t.query.categoriasGasto.findFirst({ where: eq(s.categoriasGasto.nombre, "Peritaje") });
  if (c) return c.id;
  const [nueva] = await t.insert(s.categoriasGasto).values({ nombre: "Peritaje" }).returning();
  return nueva.id;
}

export interface DatosGasto {
  categoriaId: number;
  fecha: string;
  descripcion: string | null;
  importe: number;
  estado: "PAGADO" | "PENDIENTE";
  medio: "EFECTIVO" | "BANCO";
  /** R8: quién pone la plata. Si no se dice, el salón. */
  pagadoPor?: PagadorGasto;
}

async function insertarGasto(t: Tx, usuarioId: number, v: Vehiculo, g: DatosGasto) {
  const antesFondos = await fotoFondos(t); // K13: para comparar al final
  const vehiculoId = v.id;
  const categoria = await t.query.categoriasGasto.findFirst({ where: eq(s.categoriasGasto.id, g.categoriaId) });
  if (!categoria) throw new ErrorNegocio("Categoría inválida");
  // R6: un gasto que aparece con el auto ya vendido lo asume el salón y no suma al costo.
  const extraordinario = v.estado === "VENDIDO" || v.estado === "ENTREGADO";
  const etiqueta = `${categoria.nombre} · ${v.marca} ${v.modelo}${v.dominio ? ` ${v.dominio}` : ""}`;
  // R8: el dueño (inversor que financia o consignante) puede pagar el gasto de su bolsillo: no pasa
  // por la caja del salón y se le devuelve al vender. Un gasto extraordinario es siempre del salón (R6).
  const pagadoPor: PagadorGasto = g.pagadoPor ?? "SALON";
  let dueno: string | null = null;
  if (pagadoPor === "DUENO") {
    if (extraordinario) throw new ErrorNegocio("El auto ya se vendió: el gasto lo asume el salón (R6).");
    dueno = await nombreDelDueno(t, v);
    if (!dueno) throw new ErrorNegocio("El auto es del salón: el gasto lo paga el salón.");
  }

  let movimientoId: number | null = null;
  let cuentaPendienteId: number | null = null;
  if (pagadoPor === "DUENO") {
    // No toca la caja del salón ni queda como deuda: ya lo pagó el dueño.
  } else if (g.estado === "PAGADO") {
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
    await exigirFondos(t, antesFondos);
  } else {
    const [c] = await t
      .insert(s.cuentasPendientes)
      .values({ tipo: "A_PAGAR", origen: "GASTO", contraparte: g.descripcion || categoria.nombre, vehiculoId, importe: g.importe, saldo: g.importe, notas: etiqueta })
      .returning();
    cuentaPendienteId = c.id;
  }
  const [gasto] = await t
    .insert(s.gastos)
    .values({ ...g, estado: pagadoPor === "DUENO" ? "PAGADO" : g.estado, pagadoPor, vehiculoId, extraordinario, movimientoId, cuentaPendienteId, creadoPor: usuarioId })
    .returning();
  await auditar(t, {
    usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: "CREAR", despues: gasto,
    descripcion: `Gasto ${categoria.nombre} $ ${g.importe.toLocaleString("es-AR")}${extraordinario ? " (extraordinario del salón)" : ""}${dueno ? ` — lo pagó ${dueno}` : g.estado === "PENDIENTE" ? " — a pagar" : ""}`,
  });
  return gasto;
}

export async function eliminarGasto(usuarioId: number, vehiculoId: number, gastoId: number) {
  await db.transaction(async (t) => {
    const gasto = await t.query.gastos.findFirst({ where: and(eq(s.gastos.id, gastoId), eq(s.gastos.vehiculoId, vehiculoId)) });
    if (!gasto) throw new ErrorNegocio("El gasto no existe");
    await borrarGasto(t, usuarioId, gasto);
    // Si era el costo del peritaje, el peritaje queda sin costo.
    await t.update(s.peritajes).set({ costo: null, gastoId: null }).where(eq(s.peritajes.gastoId, gastoId));
  });
}

async function borrarGasto(t: Tx, usuarioId: number, gasto: typeof s.gastos.$inferSelect) {
  const vehiculoId = gasto.vehiculoId;
  const gastoId = gasto.id;
  if (gasto.cuentaPendienteId) {
    const c = await t.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, gasto.cuentaPendienteId) });
    if (c && c.saldo !== c.importe) throw new ErrorNegocio("El gasto ya tiene pagos registrados: anulalos primero desde Caja (Ver → Anular en cada pago) y después eliminalo");
  }
  await t.delete(s.gastos).where(eq(s.gastos.id, gastoId));
  if (gasto.movimientoId) {
    await t.update(s.movimientosCaja).set({ anulado: true, motivoAnulacion: "Gasto eliminado" }).where(eq(s.movimientosCaja.id, gasto.movimientoId));
  }
  if (gasto.cuentaPendienteId) {
    // Si la cuenta tuvo pagos (ya anulados), queda en el historial de la caja: se cierra en cero en vez de borrarse.
    const usada = await t.query.movimientosCaja.findFirst({ where: eq(s.movimientosCaja.cuentaPendienteId, gasto.cuentaPendienteId) });
    if (usada) {
      await t.update(s.cuentasPendientes).set({ importe: 0, saldo: 0, estado: "CANCELADA", notas: sql`coalesce(${s.cuentasPendientes.notas}, '') || ' · Gasto eliminado'` }).where(eq(s.cuentasPendientes.id, gasto.cuentaPendienteId));
    } else {
      await t.delete(s.cuentasPendientes).where(eq(s.cuentasPendientes.id, gasto.cuentaPendienteId));
    }
  }
  await auditar(t, {
    usuarioId, entidad: ENTIDAD, entidadId: vehiculoId, accion: "ELIMINAR", antes: gasto,
    descripcion: `Gasto eliminado: $ ${gasto.importe.toLocaleString("es-AR")}`,
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
    .values({ fecha, valor, usuarioId, fuente: "MANUAL" })
    .onConflictDoUpdate({ target: s.tiposCambio.fecha, set: { valor, usuarioId, fuente: "MANUAL" } });
}
