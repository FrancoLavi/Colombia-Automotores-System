import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { r2 } from "@/domain/negocio";
import { diasEnStock } from "@/domain/negocio";
import { periodoDe } from "@/domain/dashboard";
import { numeroOperacion } from "@/domain/ventas";
import { coincideAuto, type FiltroAuto } from "@/domain/autos";
import { balanceDelSalon, capitalDelInversor, patrimonioSalon, saldos } from "@/domain/caja";
import { hoyIso } from "@/lib/formato";

/** Rango de un año calendario como fechas ISO y como timestamps. */
function rangoAnio(anio: number) {
  return {
    desde: `${anio}-01-01`,
    hasta: `${anio}-12-31`,
    desdeTs: new Date(`${anio}-01-01T00:00:00`),
    hastaTs: new Date(`${anio}-12-31T23:59:59`),
  };
}

export const mesesDelAnio = (anio: number) => Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`);

/** Años con movimientos (para el selector), siempre incluye el actual. */
export async function aniosDisponibles() {
  const [r] = await db.select({ min: sql<string | null>`min(${s.movimientosCaja.fecha})::text` }).from(s.movimientosCaja);
  const actual = new Date().getFullYear();
  const desde = r.min ? Number(r.min.slice(0, 4)) : actual;
  return Array.from({ length: actual - desde + 1 }, (_, i) => actual - i);
}

// ---------- Ganancias del salón y de cada inversor ----------

export interface FiltrosReporte {
  /** "AAAA-MM": solo ese mes. Sin mes, todo el año. */
  mes?: string;
  auto?: FiltroAuto;
}

/** Si una fecha (o un período "AAAA-MM") cae en el mes pedido. Sin mes, siempre. */
export const enMes = (fecha: Date | string | null | undefined, mes?: string) => !mes || (fecha != null && periodoDe(fecha) === mes);

/**
 * HU-8.1: la ganancia de cada uno (el salón y cada inversor) por las ventas cerradas en el período,
 * contada en el mes del cierre (R3). Del inversor se ve además cuánto ya cobró y cuánto falta;
 * la del salón queda en su caja al cerrar (K5). El capital que se le devuelve al inversor no es
 * ganancia de nadie (K10) y no aparece.
 */
export async function gananciasPorDueno(anio: number, f: FiltrosReporte = {}) {
  const filas = await db
    .select({
      importe: s.distribuciones.importe,
      estado: s.distribuciones.estado,
      participe: { id: s.participes.id, nombre: s.participes.nombre, tipo: s.participes.tipo },
      op: { id: s.operaciones.id, fechaCierre: s.operaciones.fechaCierre },
      auto: { id: s.vehiculos.id, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, anio: s.vehiculos.anio, dominio: s.vehiculos.dominio },
    })
    .from(s.distribuciones)
    .innerJoin(s.participes, eq(s.participes.id, s.distribuciones.participeId))
    .innerJoin(s.liquidaciones, eq(s.liquidaciones.id, s.distribuciones.liquidacionId))
    .innerJoin(s.operaciones, eq(s.operaciones.id, s.liquidaciones.operacionId))
    .innerJoin(s.vehiculos, eq(s.vehiculos.id, s.operaciones.vehiculoId))
    .where(
      and(
        eq(s.distribuciones.tipo, "GANANCIA"),
        inArray(s.operaciones.estado, ["CERRADA", "ENTREGADA"]),
        gte(s.operaciones.fechaCierre, `${anio}-01-01`),
        lte(s.operaciones.fechaCierre, `${anio}-12-31`),
      ),
    )
    .orderBy(desc(s.operaciones.fechaCierre), desc(s.operaciones.id));
  const delAuto = filas.filter((x) => coincideAuto(x.auto, f.auto ?? {}));
  const delPeriodo = delAuto.filter((x) => enMes(x.op.fechaCierre, f.mes));
  // El salón siempre primero, aunque no haya ganado nada todavía; después cada inversor que tuvo ventas.
  const salon = await db.query.participes.findFirst({ where: eq(s.participes.tipo, "SALON") });
  const vistos = new Map(filas.map((x) => [x.participe.id, x.participe]));
  if (salon) vistos.set(salon.id, { id: salon.id, nombre: salon.nombre, tipo: salon.tipo });
  const participes = [...vistos.values()].sort((a, b) => (a.tipo === "SALON" ? -1 : b.tipo === "SALON" ? 1 : a.nombre.localeCompare(b.nombre)));
  const suma = (xs: typeof filas) => r2(xs.reduce((a, x) => a + x.importe, 0));

  const porDueno = participes.map((p) => {
    const suyas = delPeriodo.filter((x) => x.participe.id === p.id);
    const esSalon = p.tipo === "SALON";
    return {
      participe: p,
      ventas: suyas.length,
      total: suma(suyas),
      // K5: lo del salón ya está en su caja; del inversor, lo que se le pagó y lo que falta.
      cobrado: esSalon ? suma(suyas) : suma(suyas.filter((x) => x.estado === "PAGADO")),
      pendiente: esSalon ? 0 : suma(suyas.filter((x) => x.estado === "PENDIENTE")),
      // Para el gráfico: los 12 meses del año (con el filtro de auto, sin el de mes).
      porMes: mesesDelAnio(anio).map((periodo) => suma(delAuto.filter((x) => x.participe.id === p.id && periodoDe(x.op.fechaCierre!) === periodo))),
    };
  });

  // Una fila por venta, con la parte de cada uno.
  const ventas = [...new Map(delPeriodo.map((x) => [x.op.id, x])).values()].map((x) => {
    const partes = delPeriodo.filter((y) => y.op.id === x.op.id);
    return {
      op: x.op,
      numero: numeroOperacion(x.op.id),
      auto: x.auto,
      partes: Object.fromEntries(partes.map((y) => [y.participe.id, { importe: y.importe, pendiente: y.participe.tipo !== "SALON" && y.estado === "PENDIENTE" }])),
      total: suma(partes),
    };
  });
  const meses = mesesDelAnio(anio)
    .filter((periodo) => !f.mes || periodo === f.mes)
    .map((periodo) => {
      const delMes = delAuto.filter((x) => periodoDe(x.op.fechaCierre!) === periodo);
      return { periodo, porParticipe: Object.fromEntries(participes.map((p) => [p.id, suma(delMes.filter((x) => x.participe.id === p.id))])), total: suma(delMes) };
    });
  return { porDueno, ventas, meses, total: suma(delPeriodo), autos: filas.map((x) => x.auto) };
}

// ---------- Lo que se llevó cada persona (sueldos y retiros) ----------

export async function retirosPorPersona(anio: number, f: FiltrosReporte = {}) {
  const { desdeTs, hastaTs } = rangoAnio(anio);
  const filas = await db
    .select({
      m: { id: s.movimientosCaja.id, fecha: s.movimientosCaja.fecha, categoria: s.movimientosCaja.categoria, importe: s.movimientosCaja.importe, sentido: s.movimientosCaja.sentido, concepto: s.movimientosCaja.concepto },
      persona: { id: s.personas.id, nombre: s.personas.nombre, rol: s.personas.rol },
    })
    .from(s.movimientosCaja)
    .innerJoin(s.personas, eq(s.personas.id, s.movimientosCaja.personaId))
    .where(and(eq(s.movimientosCaja.anulado, false), gte(s.movimientosCaja.fecha, desdeTs), lte(s.movimientosCaja.fecha, hastaTs)))
    .orderBy(desc(s.movimientosCaja.fecha));
  // Los egresos (sueldo, retiro) suman a lo que se llevó; un aporte (ingreso) resta.
  const signo = (f: (typeof filas)[number]) => (f.m.sentido === "EGRESO" ? f.m.importe : -f.m.importe);
  const personas = await db.select().from(s.personas).orderBy(asc(s.personas.rol), asc(s.personas.nombre));
  const delPeriodo = filas.filter((x) => enMes(x.m.fecha, f.mes));
  const resumen = personas
    .map((p) => {
      const delAnio = filas.filter((x) => x.persona.id === p.id);
      const suyas = delPeriodo.filter((x) => x.persona.id === p.id);
      const porMes = mesesDelAnio(anio).map((periodo) => r2(delAnio.filter((f) => periodoDe(f.m.fecha) === periodo).reduce((a, f) => a + signo(f), 0)));
      return {
        persona: p,
        sueldos: r2(suyas.filter((f) => f.m.categoria === "SUELDO").reduce((a, f) => a + f.m.importe, 0)),
        retiros: r2(suyas.filter((f) => f.m.categoria === "RETIRO_SOCIO").reduce((a, f) => a + f.m.importe, 0)),
        aportes: r2(suyas.filter((f) => f.m.categoria === "APORTE").reduce((a, f) => a + f.m.importe, 0)),
        total: r2(suyas.reduce((a, f) => a + signo(f), 0)),
        porMes,
      };
    })
    .filter((x) => x.persona.activo || x.total !== 0);
  return { resumen, detalle: delPeriodo };
}

// ---------- Histórico de ventas ----------

export async function historicoVentas(anio: number, f: FiltrosReporte = {}) {
  const { desde, hasta } = rangoAnio(anio);
  const filas = await db
    .select({
      op: { id: s.operaciones.id, fechaCierre: s.operaciones.fechaCierre, fechaEntrega: s.operaciones.fechaEntrega, estado: s.operaciones.estado },
      l: s.liquidaciones,
      auto: { id: s.vehiculos.id, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, anio: s.vehiculos.anio, dominio: s.vehiculos.dominio, tipoIngreso: s.vehiculos.tipoIngreso },
      cliente: { id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido },
      financista: s.participes.nombre,
    })
    .from(s.operaciones)
    .innerJoin(s.liquidaciones, eq(s.liquidaciones.operacionId, s.operaciones.id))
    .innerJoin(s.vehiculos, eq(s.vehiculos.id, s.operaciones.vehiculoId))
    .innerJoin(s.contactos, eq(s.contactos.id, s.operaciones.contactoId))
    .innerJoin(s.participes, eq(s.participes.id, s.liquidaciones.participeId))
    .where(and(inArray(s.operaciones.estado, ["CERRADA", "ENTREGADA"]), gte(s.operaciones.fechaCierre, desde), lte(s.operaciones.fechaCierre, hasta)))
    .orderBy(desc(s.operaciones.fechaCierre), desc(s.operaciones.id));
  const todas = filas.filter((x) => coincideAuto(x.auto, f.auto ?? {})).map((x) => ({ ...x, numero: numeroOperacion(x.op.id) }));
  const ventas = todas.filter((x) => enMes(x.op.fechaCierre, f.mes));
  const porMes = mesesDelAnio(anio).filter((periodo) => enMes(periodo, f.mes)).map((periodo) => {
    const v = todas.filter((x) => periodoDe(x.op.fechaCierre!) === periodo);
    return {
      periodo,
      unidades: v.length,
      facturado: r2(v.reduce((a, x) => a + x.l.precio, 0)),
      ganancia: r2(v.reduce((a, x) => a + x.l.ganancia, 0)),
      salon: r2(v.reduce((a, x) => a + x.l.parteSalon, 0)),
      inversores: r2(v.reduce((a, x) => a + x.l.parteInversor, 0)),
    };
  });
  return { ventas, porMes, autos: filas.map((x) => x.auto) };
}

// ---------- Histórico de autos ----------

export async function historicoAutos(anio: number, f: FiltrosReporte = {}) {
  const { desde, hasta, desdeTs, hastaTs } = rangoAnio(anio);
  // Autos que ingresaron en el año o que se vendieron en el año.
  const autos = await db
    .select({
      v: s.vehiculos,
      financista: s.participes.nombre,
      venta: { id: s.operaciones.id, fechaCierre: s.operaciones.fechaCierre, fechaEntrega: s.operaciones.fechaEntrega },
      l: { precio: s.liquidaciones.precio, costo: s.liquidaciones.costo, ganancia: s.liquidaciones.ganancia },
    })
    .from(s.vehiculos)
    .innerJoin(s.participes, eq(s.participes.id, s.vehiculos.participeId))
    .leftJoin(s.operaciones, and(eq(s.operaciones.vehiculoId, s.vehiculos.id), inArray(s.operaciones.estado, ["CERRADA", "ENTREGADA"])))
    .leftJoin(s.liquidaciones, eq(s.liquidaciones.operacionId, s.operaciones.id))
    .where(or(and(gte(s.vehiculos.fechaIngreso, desde), lte(s.vehiculos.fechaIngreso, hasta)), and(isNotNull(s.operaciones.fechaCierre), gte(s.operaciones.fechaCierre, desde), lte(s.operaciones.fechaCierre, hasta))))
    .orderBy(desc(s.vehiculos.fechaIngreso));
  const movimientos = await db
    .select({ a: s.auditoria, usuario: s.usuarios.nombre, auto: { id: s.vehiculos.id, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, dominio: s.vehiculos.dominio } })
    .from(s.auditoria)
    .innerJoin(s.vehiculos, eq(s.vehiculos.id, s.auditoria.entidadId))
    .leftJoin(s.usuarios, eq(s.usuarios.id, s.auditoria.usuarioId))
    .where(
      and(
        eq(s.auditoria.entidad, "vehiculo"),
        gte(s.auditoria.fecha, desdeTs),
        lte(s.auditoria.fecha, hastaTs),
        or(eq(s.auditoria.accion, "CAMBIO_ESTADO"), eq(s.auditoria.accion, "CREAR"), sql`${s.auditoria.descripcion} like 'Ubicación:%'`),
      ),
    )
    .orderBy(desc(s.auditoria.fecha), desc(s.auditoria.id))
    .limit(400);
  const filtro = f.auto ?? {};
  return {
    opciones: autos.map((x) => x.v),
    autos: autos
      .filter((x) => coincideAuto(x.v, filtro) && (!f.mes || enMes(x.v.fechaIngreso, f.mes) || enMes(x.venta?.fechaCierre, f.mes)))
      .map((x) => ({
      ...x,
      dias: diasEnStock(x.v.fechaIngreso, x.v.fechaDisponible, x.venta?.fechaCierre ? new Date(`${x.venta.fechaCierre}T00:00:00`) : new Date()),
      numero: x.venta?.id ? numeroOperacion(x.venta.id) : null,
    })),
    movimientos: movimientos.filter(
      (m) => (m.a.accion !== "CREAR" || (m.a.descripcion ?? "").startsWith("Alta")) && coincideAuto(m.auto, filtro) && enMes(m.a.fecha, f.mes),
    ),
  };
}

// ---------- Ingresos, egresos y sueldos por mes ----------

export async function resumenMensual(anio: number, f: FiltrosReporte = {}) {
  const { desdeTs, hastaTs } = rangoAnio(anio);
  const movs = await db
    .select({ fecha: s.movimientosCaja.fecha, sentido: s.movimientosCaja.sentido, categoria: s.movimientosCaja.categoria, importe: s.movimientosCaja.importe })
    .from(s.movimientosCaja)
    .where(and(eq(s.movimientosCaja.anulado, false), gte(s.movimientosCaja.fecha, desdeTs), lte(s.movimientosCaja.fecha, hastaTs)));
  // Los pases entre efectivo y banco no son ingresos ni egresos del negocio.
  const reales = movs.filter((m) => m.categoria !== "TRANSFERENCIA_INTERNA");
  const categorias = [...new Set(reales.map((m) => `${m.sentido}:${m.categoria}`))].sort();
  const meses = mesesDelAnio(anio).filter((periodo) => enMes(periodo, f.mes)).map((periodo) => {
    const delMes = reales.filter((m) => periodoDe(m.fecha) === periodo);
    const suma = (f: (m: (typeof reales)[number]) => boolean) => r2(delMes.filter(f).reduce((a, m) => a + m.importe, 0));
    return {
      periodo,
      ingresos: suma((m) => m.sentido === "INGRESO"),
      egresos: suma((m) => m.sentido === "EGRESO"),
      sueldos: suma((m) => m.categoria === "SUELDO"),
      porCategoria: Object.fromEntries(categorias.map((c) => [c, suma((m) => `${m.sentido}:${m.categoria}` === c)])),
    };
  });
  // Con un mes elegido, solo los tipos que se movieron ese mes.
  return { meses, categorias: categorias.filter((c) => meses.some((x) => x.porCategoria[c])) };
}

// ---------- Foto del salón a una fecha y balance del período ----------

/** Último instante de un día en Argentina (UTC−3). */
const finDelDia = (dia: string) => new Date(`${dia}T23:59:59.999-03:00`);

/**
 * K11 a una fecha pasada: cuánto era del salón al terminar ese día. Se rehace con lo que había
 * registrado hasta ese momento: la caja, los autos en stock al costo (sin consignados ni
 * permutas de ventas que todavía no cerraban), lo que se les debía a los inversores y las
 * cuentas abiertas con su saldo de ese día.
 */
export async function patrimonioSalonAl(dia: string) {
  const corte = finDelDia(dia);
  const [movs, autos, gastos, ops, deudas, cuentas, pagosCuentas] = await Promise.all([
    db
      .select({ sentido: s.movimientosCaja.sentido, medio: s.movimientosCaja.medio, importe: s.movimientosCaja.importe, anulado: s.movimientosCaja.anulado })
      .from(s.movimientosCaja)
      .where(lte(s.movimientosCaja.fecha, corte)),
    db
      .select({ id: s.vehiculos.id, estado: s.vehiculos.estado, tipoIngreso: s.vehiculos.tipoIngreso, valorCompraArs: s.vehiculos.valorCompraArs, operacionOrigenId: s.vehiculos.operacionOrigenId, financista: s.participes.tipo })
      .from(s.vehiculos)
      .innerJoin(s.participes, eq(s.participes.id, s.vehiculos.participeId))
      .where(lte(s.vehiculos.fechaIngreso, dia)),
    db
      .select({ vehiculoId: s.gastos.vehiculoId, total: sql<number>`coalesce(sum(${s.gastos.importe}), 0)::float`, dueno: sql<number>`coalesce(sum(${s.gastos.importe}) filter (where ${s.gastos.pagadoPor} = 'DUENO'), 0)::float` })
      .from(s.gastos)
      .where(and(lte(s.gastos.fecha, dia), eq(s.gastos.extraordinario, false)))
      .groupBy(s.gastos.vehiculoId),
    db
      .select({ id: s.operaciones.id, vehiculoId: s.operaciones.vehiculoId, fechaCierre: s.operaciones.fechaCierre })
      .from(s.operaciones)
      .where(and(inArray(s.operaciones.estado, ["CERRADA", "ENTREGADA"]), lte(s.operaciones.fechaCierre, dia))),
    // Lo que se le debía al inversor ese día: de ventas ya cerradas, sin pagar todavía (o pagado después).
    db
      .select({ importe: s.distribuciones.importe, estado: s.distribuciones.estado, pagado: s.movimientosCaja.fecha })
      .from(s.distribuciones)
      .innerJoin(s.participes, eq(s.participes.id, s.distribuciones.participeId))
      .innerJoin(s.liquidaciones, eq(s.liquidaciones.id, s.distribuciones.liquidacionId))
      .innerJoin(s.operaciones, eq(s.operaciones.id, s.liquidaciones.operacionId))
      .leftJoin(s.movimientosCaja, eq(s.movimientosCaja.id, s.distribuciones.movimientoId))
      .where(and(eq(s.participes.tipo, "INVERSOR"), lte(s.operaciones.fechaCierre, dia))),
    db
      .select({ id: s.cuentasPendientes.id, tipo: s.cuentasPendientes.tipo, importe: s.cuentasPendientes.importe })
      .from(s.cuentasPendientes)
      .where(lte(s.cuentasPendientes.creadoEn, corte)),
    db
      .select({ cuentaId: s.movimientosCaja.cuentaPendienteId, total: sql<number>`coalesce(sum(${s.movimientosCaja.importe}), 0)::float` })
      .from(s.movimientosCaja)
      .where(and(lte(s.movimientosCaja.fecha, corte), eq(s.movimientosCaja.anulado, false), isNotNull(s.movimientosCaja.cuentaPendienteId)))
      .groupBy(s.movimientosCaja.cuentaPendienteId),
  ]);
  const vendidos = new Set(ops.map((o) => o.vehiculoId));
  const cerradas = new Set(ops.map((o) => o.id));
  const enStock = autos.filter(
    (a) =>
      !["RECHAZADO", "BAJA"].includes(a.estado) &&
      !vendidos.has(a.id) &&
      a.tipoIngreso !== "CONSIGNACION" &&
      // Una permuta cuenta recién cuando cerró la venta que la trajo (K3).
      !(a.tipoIngreso === "PERMUTA" && a.operacionOrigenId != null && !cerradas.has(a.operacionOrigenId)),
  );
  const stock = r2(enStock.reduce((t, a) => t + a.valorCompraArs + (gastos.find((g) => g.vehiculoId === a.id)?.total ?? 0), 0));
  const capitalInversores = r2(enStock.reduce((t, a) => t + capitalDelInversor({ tipoIngreso: a.tipoIngreso, financista: a.financista, valorCompraArs: a.valorCompraArs, gastosDelDueno: gastos.find((g) => g.vehiculoId === a.id)?.dueno ?? 0 }), 0));
  const deudaInversores = r2(deudas.filter((d) => d.estado === "PENDIENTE" || (d.pagado != null && d.pagado > corte)).reduce((t, d) => t + d.importe, 0));
  const saldoCuenta = (c: (typeof cuentas)[number]) => r2(c.importe - (pagosCuentas.find((p) => p.cuentaId === c.id)?.total ?? 0));
  const aCobrar = r2(cuentas.filter((c) => c.tipo === "A_COBRAR").reduce((t, c) => t + Math.max(0, saldoCuenta(c)), 0));
  const aPagar = r2(cuentas.filter((c) => c.tipo === "A_PAGAR").reduce((t, c) => t + Math.max(0, saldoCuenta(c)), 0));
  const caja = saldos(movs).total;
  return patrimonioSalon({ caja, stock, capitalInversores, aCobrar, aPagar, deudaInversores });
}

/**
 * HU-8.1: balance del salón en un mes (o en el año, sin mes): la foto al empezar, la foto al
 * terminar (o hoy) y qué pasó en el medio. Lo que se llevaron los socios no resta del resultado:
 * es lo que deciden hacer con él.
 */
export async function balanceSalon(anio: number, mes?: string) {
  const hoy = hoyIso();
  const desde = mes ? `${mes}-01` : `${anio}-01-01`;
  // Fechas como texto, con cuentas en UTC: así no corre el día según la zona del servidor.
  const [a, m] = (mes ?? `${anio}-12`).split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const hasta = ultimo < hoy ? ultimo : hoy;
  const diaAntes = new Date(Date.parse(`${desde}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const enCurso = ultimo >= hoy;
  if (desde > hoy) return null; // un mes que todavía no empezó

  const [inicio, fin, gananciaSalon, movs] = await Promise.all([
    patrimonioSalonAl(diaAntes),
    patrimonioSalonAl(hasta),
    db
      .select({ total: sql<number>`coalesce(sum(${s.distribuciones.importe}), 0)::float` })
      .from(s.distribuciones)
      .innerJoin(s.participes, eq(s.participes.id, s.distribuciones.participeId))
      .innerJoin(s.liquidaciones, eq(s.liquidaciones.id, s.distribuciones.liquidacionId))
      .innerJoin(s.operaciones, eq(s.operaciones.id, s.liquidaciones.operacionId))
      .where(
        and(
          eq(s.participes.tipo, "SALON"),
          eq(s.distribuciones.tipo, "GANANCIA"),
          inArray(s.operaciones.estado, ["CERRADA", "ENTREGADA"]),
          gte(s.operaciones.fechaCierre, desde),
          lte(s.operaciones.fechaCierre, hasta),
        ),
      ),
    db
      .select({ categoria: s.movimientosCaja.categoria, sentido: s.movimientosCaja.sentido, importe: s.movimientosCaja.importe, rol: s.personas.rol })
      .from(s.movimientosCaja)
      .leftJoin(s.personas, eq(s.personas.id, s.movimientosCaja.personaId))
      .where(and(eq(s.movimientosCaja.anulado, false), gte(s.movimientosCaja.fecha, new Date(`${desde}T00:00:00-03:00`)), lte(s.movimientosCaja.fecha, finDelDia(hasta)))),
  ]);
  const suma = (f: (x: (typeof movs)[number]) => boolean) => r2(movs.filter(f).reduce((t, x) => t + (x.sentido === "EGRESO" ? x.importe : -x.importe), 0));
  return {
    desde,
    hasta,
    diaAntes,
    enCurso,
    ...balanceDelSalon({
      inicio,
      fin,
      ganancia: r2(gananciaSalon[0].total),
      gastos: suma((x) => x.categoria === "GASTO_SALON" || x.categoria === "GASTO_EXTRAORDINARIO"),
      sueldosEmpleados: suma((x) => x.categoria === "SUELDO" && x.rol !== "SOCIO"),
      retirosSocios: suma((x) => x.categoria === "RETIRO_SOCIO" || (x.categoria === "SUELDO" && x.rol === "SOCIO")),
      aportes: -suma((x) => x.categoria === "APORTE" || x.categoria === "INGRESO_EXTRAORDINARIO"),
    }),
  };
}
