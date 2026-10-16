import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { auditar } from "@/lib/auditoria";
import { r2 } from "@/domain/negocio";
import { cuentaEnPatrimonio, esManual, saldos, ETIQUETA_CATEGORIA, MANUALES, type CategoriaManual, type Medio, type Sentido } from "@/domain/caja";
import { numeroOperacion } from "@/domain/ventas";
import { ErrorNegocio } from "./errores";
import { cobrarPagoPendiente } from "./ventas";

const ENTIDAD = "caja";
type Categoria = (typeof s.movimientosCaja.$inferSelect)["categoria"];

// ---------- Movimientos ----------

export interface FiltrosMovimientos {
  desde?: string;
  hasta?: string;
  medio?: Medio;
  categoria?: string;
  q?: string;
}

export async function movimientos(f: FiltrosMovimientos) {
  const cond = [];
  if (f.desde) cond.push(gte(s.movimientosCaja.fecha, new Date(`${f.desde}T00:00:00`)));
  if (f.hasta) cond.push(lte(s.movimientosCaja.fecha, new Date(`${f.hasta}T23:59:59`)));
  if (f.medio) cond.push(eq(s.movimientosCaja.medio, f.medio));
  if (f.categoria) cond.push(eq(s.movimientosCaja.categoria, f.categoria as Categoria));
  if (f.q?.trim()) cond.push(sql`${s.movimientosCaja.concepto} ilike ${"%" + f.q.trim() + "%"}`);
  const filas = await db
    .select({ m: s.movimientosCaja, usuario: s.usuarios.nombre })
    .from(s.movimientosCaja)
    .leftJoin(s.usuarios, eq(s.usuarios.id, s.movimientosCaja.usuarioId))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(s.movimientosCaja.fecha), desc(s.movimientosCaja.id))
    .limit(500);
  const todos = await db.select({ sentido: s.movimientosCaja.sentido, medio: s.movimientosCaja.medio, importe: s.movimientosCaja.importe, anulado: s.movimientosCaja.anulado }).from(s.movimientosCaja);
  const vigentes = filas.filter((x) => !x.m.anulado);
  return {
    movimientos: filas.map((x) => ({ ...x, manual: esManual(x.m.categoria) })),
    saldos: saldos(todos),
    ingresos: r2(vigentes.filter((x) => x.m.sentido === "INGRESO").reduce((a, x) => a + x.m.importe, 0)),
    egresos: r2(vigentes.filter((x) => x.m.sentido === "EGRESO").reduce((a, x) => a + x.m.importe, 0)),
  };
}

export async function crearMovimiento(
  usuarioId: number,
  d: { categoria: CategoriaManual; sentido: Sentido | null; medio: Medio; importe: number; concepto: string; fecha: Date; participeId: number | null },
) {
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  const sentido = MANUALES[d.categoria] ?? d.sentido;
  if (!sentido) throw new ErrorNegocio("Indicá si el ajuste es ingreso o egreso");
  await db.transaction(async (t) => {
    const [m] = await t
      .insert(s.movimientosCaja)
      .values({ fecha: d.fecha, sentido, medio: d.medio, categoria: d.categoria, importe: d.importe, concepto: d.concepto, participeId: d.participeId, usuarioId })
      .returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: m.id, accion: "CREAR", despues: m, descripcion: `${ETIQUETA_CATEGORIA[d.categoria]}: ${d.concepto} · $ ${d.importe.toLocaleString("es-AR")}` });
  });
}

/** Pase entre efectivo y banco (depósito o extracción): dos movimientos que se compensan. */
export async function transferenciaInterna(usuarioId: number, d: { desde: Medio; importe: number; fecha: Date; concepto: string | null }) {
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  const hacia: Medio = d.desde === "EFECTIVO" ? "BANCO" : "EFECTIVO";
  const concepto = d.concepto ?? (d.desde === "EFECTIVO" ? "Depósito en banco" : "Extracción del banco");
  await db.transaction(async (t) => {
    const [a] = await t.insert(s.movimientosCaja).values({ fecha: d.fecha, sentido: "EGRESO", medio: d.desde, categoria: "TRANSFERENCIA_INTERNA", importe: d.importe, concepto, usuarioId }).returning();
    await t.insert(s.movimientosCaja).values({ fecha: d.fecha, sentido: "INGRESO", medio: hacia, categoria: "TRANSFERENCIA_INTERNA", importe: d.importe, concepto, usuarioId });
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: a.id, accion: "CREAR", descripcion: `${concepto} · $ ${d.importe.toLocaleString("es-AR")}` });
  });
}

/** Solo se anulan movimientos cargados a mano; los demás se corrigen desde su origen (gasto, venta, cuenta). */
export async function anularMovimiento(usuarioId: number, id: number, motivo: string) {
  await db.transaction(async (t) => {
    const m = await t.query.movimientosCaja.findFirst({ where: eq(s.movimientosCaja.id, id) });
    if (!m) throw new ErrorNegocio("El movimiento no existe");
    if (m.anulado) return;
    if (!esManual(m.categoria)) throw new ErrorNegocio("Este movimiento lo generó otra operación: corregilo desde su origen (gasto, venta o cuenta)");
    const ids = [id];
    if (m.categoria === "TRANSFERENCIA_INTERNA") {
      // Anula también la contrapartida del pase.
      const par = await t
        .select()
        .from(s.movimientosCaja)
        .where(and(eq(s.movimientosCaja.categoria, "TRANSFERENCIA_INTERNA"), eq(s.movimientosCaja.importe, m.importe), eq(s.movimientosCaja.fecha, m.fecha), eq(s.movimientosCaja.anulado, false)));
      ids.push(...par.filter((p) => p.id !== id && p.sentido !== m.sentido).slice(0, 1).map((p) => p.id));
    }
    await t.update(s.movimientosCaja).set({ anulado: true, motivoAnulacion: motivo }).where(inArray(s.movimientosCaja.id, ids));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "ELIMINAR", antes: m, descripcion: `Anulado: ${m.concepto} (${motivo})` });
  });
}

// ---------- Ganancias por pagar ----------

export async function gananciasPendientes() {
  const filas = await db
    .select({
      d: s.distribuciones,
      participe: { id: s.participes.id, nombre: s.participes.nombre, tipo: s.participes.tipo },
      operacionId: s.liquidaciones.operacionId,
      auto: { marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, anio: s.vehiculos.anio, dominio: s.vehiculos.dominio },
      fechaCierre: s.operaciones.fechaCierre,
    })
    .from(s.distribuciones)
    .innerJoin(s.participes, eq(s.participes.id, s.distribuciones.participeId))
    .innerJoin(s.liquidaciones, eq(s.liquidaciones.id, s.distribuciones.liquidacionId))
    .innerJoin(s.operaciones, eq(s.operaciones.id, s.liquidaciones.operacionId))
    .innerJoin(s.vehiculos, eq(s.vehiculos.id, s.operaciones.vehiculoId))
    .where(eq(s.distribuciones.estado, "PENDIENTE"))
    .orderBy(asc(s.operaciones.fechaCierre));
  return filas.map((x) => ({ ...x, numero: numeroOperacion(x.operacionId) }));
}

/** K5: paga (o retira) la parte de una venta. Si la parte es negativa (venta con pérdida), el participe la reintegra. */
export async function pagarDistribucion(usuarioId: number, id: number, medio: Medio) {
  await db.transaction(async (t) => {
    const d = await t.query.distribuciones.findFirst({ where: eq(s.distribuciones.id, id) });
    if (!d) throw new ErrorNegocio("No existe");
    if (d.estado === "PAGADO") throw new ErrorNegocio("Ya está pagado");
    const p = (await t.query.participes.findFirst({ where: eq(s.participes.id, d.participeId) }))!;
    const liq = (await t.query.liquidaciones.findFirst({ where: eq(s.liquidaciones.id, d.liquidacionId) }))!;
    const op = (await t.query.operaciones.findFirst({ where: eq(s.operaciones.id, liq.operacionId) }))!;
    const reintegro = d.importe < 0;
    const [m] = await t
      .insert(s.movimientosCaja)
      .values({
        sentido: reintegro ? "INGRESO" : "EGRESO",
        medio,
        categoria: reintegro ? "AJUSTE" : p.tipo === "INVERSOR" ? "PAGO_INVERSOR" : "RETIRO_SOCIO",
        importe: Math.abs(d.importe),
        concepto: `${reintegro ? "Reintegro de pérdida" : p.tipo === "INVERSOR" ? "Ganancia" : "Retiro ganancia salón"} ${numeroOperacion(op.id)} · ${p.nombre}`,
        operacionId: op.id,
        vehiculoId: op.vehiculoId,
        participeId: p.id,
        usuarioId,
      })
      .returning();
    await t.update(s.distribuciones).set({ estado: "PAGADO", movimientoId: m.id }).where(eq(s.distribuciones.id, id));
    await auditar(t, {
      usuarioId, entidad: "operacion", entidadId: op.id, accion: "MODIFICAR",
      descripcion: `${reintegro ? "Reintegro" : "Pago de ganancia"} a ${p.nombre}: $ ${Math.abs(d.importe).toLocaleString("es-AR")}`,
    });
  });
}

// ---------- Cuentas pendientes ----------

export async function listarCuentas(f: { tipo?: "A_COBRAR" | "A_PAGAR"; todas?: boolean }) {
  const cond = [];
  if (f.tipo) cond.push(eq(s.cuentasPendientes.tipo, f.tipo));
  if (!f.todas) cond.push(eq(s.cuentasPendientes.estado, "ABIERTA"));
  const filas = await db
    .select({ c: s.cuentasPendientes, auto: { id: s.vehiculos.id, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, dominio: s.vehiculos.dominio } })
    .from(s.cuentasPendientes)
    .leftJoin(s.vehiculos, eq(s.vehiculos.id, s.cuentasPendientes.vehiculoId))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(sql`${s.cuentasPendientes.vencimiento} asc nulls last`, desc(s.cuentasPendientes.id));
  return filas;
}

export async function crearCuenta(
  usuarioId: number,
  d: { tipo: "A_COBRAR" | "A_PAGAR"; contraparte: string; importe: number; vencimiento: string | null; notas: string | null },
) {
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  await db.transaction(async (t) => {
    const [c] = await t.insert(s.cuentasPendientes).values({ ...d, origen: "MANUAL", saldo: d.importe }).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: c.id, accion: "CREAR", despues: c, descripcion: `Cuenta ${d.tipo === "A_COBRAR" ? "a cobrar" : "a pagar"}: ${d.contraparte} $ ${d.importe.toLocaleString("es-AR")}` });
  });
}

const CATEGORIA_CUENTA: Record<string, Record<string, Categoria>> = {
  A_COBRAR: { CREDITO_BANCARIO: "COBRO_CREDITO", MANUAL: "COBRO_CUENTA", SALDO_COMPRA: "COBRO_CUENTA", CONSIGNANTE: "COBRO_CUENTA", GASTO: "COBRO_CUENTA" },
  A_PAGAR: { CONSIGNANTE: "PAGO_CONSIGNANTE", SALDO_COMPRA: "PAGO_COMPRA", GASTO: "GASTO_VEHICULO", MANUAL: "PAGO_CUENTA", CREDITO_BANCARIO: "PAGO_CUENTA" },
};

/** HU-5.5/5.6: cobro o pago (total o parcial) de una cuenta pendiente. */
export async function registrarPagoCuenta(usuarioId: number, cuentaId: number, importe: number, medio: Medio) {
  if (!(importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  const c = await db.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, cuentaId) });
  if (!c || c.estado !== "ABIERTA") throw new ErrorNegocio("La cuenta no está abierta");
  if (r2(importe) > r2(c.saldo)) throw new ErrorNegocio(`Supera el saldo de $ ${c.saldo.toLocaleString("es-AR")}`);

  // Si la cuenta salió de un pago de venta (crédito o saldo del cliente), se cobra desde la venta.
  const pago = await db.query.pagosOperacion.findFirst({ where: eq(s.pagosOperacion.cuentaPendienteId, cuentaId) });
  if (pago) {
    if (r2(importe) !== r2(c.saldo)) throw new ErrorNegocio("Los cobros de una venta se registran por el total");
    await cobrarPagoPendiente(usuarioId, pago.operacionId, pago.id, medio);
    return;
  }

  await db.transaction(async (t) => {
    let categoria = CATEGORIA_CUENTA[c.tipo][c.origen];
    const gasto = c.origen === "GASTO" ? await t.query.gastos.findFirst({ where: eq(s.gastos.cuentaPendienteId, cuentaId) }) : null;
    if (gasto?.extraordinario) categoria = "GASTO_EXTRAORDINARIO";
    const [m] = await t
      .insert(s.movimientosCaja)
      .values({
        sentido: c.tipo === "A_COBRAR" ? "INGRESO" : "EGRESO",
        medio,
        categoria,
        importe,
        concepto: `${c.tipo === "A_COBRAR" ? "Cobro" : "Pago"} a ${c.contraparte}${c.notas ? ` · ${c.notas}` : ""}`,
        cuentaPendienteId: c.id,
        vehiculoId: c.vehiculoId,
        operacionId: c.operacionId,
        usuarioId,
      })
      .returning();
    const saldo = r2(c.saldo - importe);
    await t.update(s.cuentasPendientes).set({ saldo, estado: saldo === 0 ? "CANCELADA" : "ABIERTA" }).where(eq(s.cuentasPendientes.id, c.id));
    if (gasto && saldo === 0) await t.update(s.gastos).set({ estado: "PAGADO", movimientoId: m.id }).where(eq(s.gastos.id, gasto.id));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: m.id, accion: "CREAR",
      descripcion: `${c.tipo === "A_COBRAR" ? "Cobro" : "Pago"} ${saldo === 0 ? "total" : "parcial"} a ${c.contraparte}: $ ${importe.toLocaleString("es-AR")}`,
    });
  });
}

// ---------- Patrimonio e inversores ----------

/** Autos en stock con su costo (sin gastos extraordinarios) y el estado de la venta que trajo la permuta. */
async function stockConCosto() {
  const autos = await db
    .select({
      id: s.vehiculos.id,
      marca: s.vehiculos.marca,
      modelo: s.vehiculos.modelo,
      anio: s.vehiculos.anio,
      dominio: s.vehiculos.dominio,
      estado: s.vehiculos.estado,
      tipoIngreso: s.vehiculos.tipoIngreso,
      participeId: s.vehiculos.participeId,
      valorCompraArs: s.vehiculos.valorCompraArs,
      operacionOrigenId: s.vehiculos.operacionOrigenId,
      tcIngreso: s.vehiculos.tcIngreso,
    })
    .from(s.vehiculos)
    .where(inArray(s.vehiculos.estado, ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"]));
  const ids = autos.map((a) => a.id);
  const gastos = ids.length
    ? await db
        .select({ vehiculoId: s.gastos.vehiculoId, total: sql<number>`coalesce(sum(${s.gastos.importe}), 0)::float` })
        .from(s.gastos)
        .where(and(inArray(s.gastos.vehiculoId, ids), eq(s.gastos.extraordinario, false)))
        .groupBy(s.gastos.vehiculoId)
    : [];
  const opsOrigen = autos.map((a) => a.operacionOrigenId).filter((x): x is number => x != null);
  const ops = opsOrigen.length ? await db.select({ id: s.operaciones.id, estado: s.operaciones.estado }).from(s.operaciones).where(inArray(s.operaciones.id, opsOrigen)) : [];
  return autos.map((a) => {
    const costo = r2(a.valorCompraArs + (gastos.find((g) => g.vehiculoId === a.id)?.total ?? 0));
    const estadoOperacionOrigen = ops.find((o) => o.id === a.operacionOrigenId)?.estado ?? null;
    return { ...a, costo, estadoOperacionOrigen, enPatrimonio: cuentaEnPatrimonio({ ...a, costo, estadoOperacionOrigen }) };
  });
}

export async function patrimonio() {
  const [movs, autos, cuentas, pendientes] = await Promise.all([
    db.select({ sentido: s.movimientosCaja.sentido, medio: s.movimientosCaja.medio, importe: s.movimientosCaja.importe, anulado: s.movimientosCaja.anulado }).from(s.movimientosCaja),
    stockConCosto(),
    db.select({ tipo: s.cuentasPendientes.tipo, saldo: s.cuentasPendientes.saldo }).from(s.cuentasPendientes).where(eq(s.cuentasPendientes.estado, "ABIERTA")),
    gananciasPendientes(),
  ]);
  const caja = saldos(movs);
  const propios = autos.filter((a) => a.enPatrimonio);
  const stock = r2(propios.reduce((a, x) => a + x.costo, 0));
  const aCobrar = r2(cuentas.filter((c) => c.tipo === "A_COBRAR").reduce((a, c) => a + c.saldo, 0));
  const aPagar = r2(cuentas.filter((c) => c.tipo === "A_PAGAR").reduce((a, c) => a + c.saldo, 0));
  // La parte de los inversores todavía no pagada es plata que se les debe.
  const aInversores = r2(pendientes.filter((p) => p.participe.tipo === "INVERSOR").reduce((a, p) => a + p.d.importe, 0));
  return {
    caja,
    stock,
    autosEnStock: propios.length,
    consignados: autos.filter((a) => a.tipoIngreso === "CONSIGNACION").length,
    aCobrar,
    aPagar,
    aInversores,
    total: r2(caja.total + stock + aCobrar - aPagar - aInversores),
  };
}

/** K6: subcaja por inversor (y por el salón con fondos propios). */
export async function subcajas() {
  const [participes, autos, dist] = await Promise.all([
    db.select().from(s.participes).where(eq(s.participes.activo, true)).orderBy(asc(s.participes.id)),
    stockConCosto(),
    db
      .select({ participeId: s.distribuciones.participeId, estado: s.distribuciones.estado, importe: s.distribuciones.importe })
      .from(s.distribuciones),
  ]);
  return participes.map((p) => {
    const suyos = autos.filter((a) => a.enPatrimonio && a.participeId === p.id);
    const d = dist.filter((x) => x.participeId === p.id);
    return {
      participe: p,
      autos: suyos,
      capital: r2(suyos.reduce((a, x) => a + x.costo, 0)),
      capitalUsd: r2(suyos.reduce((a, x) => a + x.costo / x.tcIngreso, 0)),
      pendiente: r2(d.filter((x) => x.estado === "PENDIENTE").reduce((a, x) => a + x.importe, 0)),
      cobrado: r2(d.filter((x) => x.estado === "PAGADO").reduce((a, x) => a + x.importe, 0)),
      ventas: d.length,
    };
  });
}
