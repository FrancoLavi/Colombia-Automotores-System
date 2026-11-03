import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { r2 } from "@/domain/negocio";
import { diasEnStock } from "@/domain/negocio";
import { periodoDe } from "@/domain/dashboard";
import { numeroOperacion } from "@/domain/ventas";

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

// ---------- Ganancias pagadas por mes ----------

export async function gananciasPagadasPorMes(anio: number) {
  const { desdeTs, hastaTs } = rangoAnio(anio);
  const filas = await db
    .select({
      fecha: s.movimientosCaja.fecha,
      importe: s.distribuciones.importe,
      participe: { id: s.participes.id, nombre: s.participes.nombre, tipo: s.participes.tipo },
    })
    .from(s.distribuciones)
    .innerJoin(s.movimientosCaja, eq(s.movimientosCaja.id, s.distribuciones.movimientoId))
    .innerJoin(s.participes, eq(s.participes.id, s.distribuciones.participeId))
    .where(
      and(
        eq(s.distribuciones.estado, "PAGADO"),
        // La devolución del capital al inversor (K10) no es ganancia de nadie.
        eq(s.distribuciones.tipo, "GANANCIA"),
        eq(s.movimientosCaja.anulado, false),
        gte(s.movimientosCaja.fecha, desdeTs),
        lte(s.movimientosCaja.fecha, hastaTs),
      ),
    );
  // K5: la ganancia del salón no se paga con un movimiento: queda en su caja al cerrar la venta.
  // Cuenta en el mes del cierre. (Las ventas viejas la tienen pagada con un retiro: van arriba.)
  const delSalon = await db
    .select({
      fechaCierre: s.operaciones.fechaCierre,
      importe: s.distribuciones.importe,
      participe: { id: s.participes.id, nombre: s.participes.nombre, tipo: s.participes.tipo },
    })
    .from(s.distribuciones)
    .innerJoin(s.participes, eq(s.participes.id, s.distribuciones.participeId))
    .innerJoin(s.liquidaciones, eq(s.liquidaciones.id, s.distribuciones.liquidacionId))
    .innerJoin(s.operaciones, eq(s.operaciones.id, s.liquidaciones.operacionId))
    .where(
      and(
        eq(s.participes.tipo, "SALON"),
        eq(s.distribuciones.estado, "PAGADO"),
        eq(s.distribuciones.tipo, "GANANCIA"),
        sql`${s.distribuciones.movimientoId} is null`,
        gte(s.operaciones.fechaCierre, `${anio}-01-01`),
        lte(s.operaciones.fechaCierre, `${anio}-12-31`),
      ),
    );
  filas.push(...delSalon.map((x) => ({ fecha: new Date(`${x.fechaCierre}T12:00:00`), importe: x.importe, participe: x.participe })));
  const participes = [...new Map(filas.map((f) => [f.participe.id, f.participe])).values()].sort((a, b) => (a.tipo === "SALON" ? -1 : b.tipo === "SALON" ? 1 : a.nombre.localeCompare(b.nombre)));
  const meses = mesesDelAnio(anio).map((periodo) => {
    const delMes = filas.filter((f) => periodoDe(f.fecha) === periodo);
    const porParticipe = Object.fromEntries(participes.map((p) => [p.id, r2(delMes.filter((f) => f.participe.id === p.id).reduce((a, f) => a + f.importe, 0))]));
    return { periodo, porParticipe, total: r2(delMes.reduce((a, f) => a + f.importe, 0)) };
  });
  const totales = Object.fromEntries(participes.map((p) => [p.id, r2(meses.reduce((a, m) => a + m.porParticipe[p.id], 0))]));
  return { participes, meses, totales, total: r2(meses.reduce((a, m) => a + m.total, 0)) };
}

// ---------- Lo que se llevó cada persona (sueldos y retiros) ----------

export async function retirosPorPersona(anio: number) {
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
  const resumen = personas
    .map((p) => {
      const suyas = filas.filter((f) => f.persona.id === p.id);
      const porMes = mesesDelAnio(anio).map((periodo) => r2(suyas.filter((f) => periodoDe(f.m.fecha) === periodo).reduce((a, f) => a + signo(f), 0)));
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
  return { resumen, detalle: filas };
}

// ---------- Histórico de ventas ----------

export async function historicoVentas(anio: number) {
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
  const ventas = filas.map((f) => ({ ...f, numero: numeroOperacion(f.op.id) }));
  const porMes = mesesDelAnio(anio).map((periodo) => {
    const v = ventas.filter((x) => periodoDe(x.op.fechaCierre!) === periodo);
    return {
      periodo,
      unidades: v.length,
      facturado: r2(v.reduce((a, x) => a + x.l.precio, 0)),
      ganancia: r2(v.reduce((a, x) => a + x.l.ganancia, 0)),
      salon: r2(v.reduce((a, x) => a + x.l.parteSalon, 0)),
      inversores: r2(v.reduce((a, x) => a + x.l.parteInversor, 0)),
    };
  });
  return { ventas, porMes };
}

// ---------- Histórico de autos ----------

export async function historicoAutos(anio: number) {
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
  return {
    autos: autos.map((x) => ({
      ...x,
      dias: diasEnStock(x.v.fechaIngreso, x.v.fechaDisponible, x.venta?.fechaCierre ? new Date(`${x.venta.fechaCierre}T00:00:00`) : new Date()),
      numero: x.venta?.id ? numeroOperacion(x.venta.id) : null,
    })),
    movimientos: movimientos.filter((m) => m.a.accion !== "CREAR" || (m.a.descripcion ?? "").startsWith("Alta")),
  };
}

// ---------- Ingresos, egresos y sueldos por mes ----------

export async function resumenMensual(anio: number) {
  const { desdeTs, hastaTs } = rangoAnio(anio);
  const movs = await db
    .select({ fecha: s.movimientosCaja.fecha, sentido: s.movimientosCaja.sentido, categoria: s.movimientosCaja.categoria, importe: s.movimientosCaja.importe })
    .from(s.movimientosCaja)
    .where(and(eq(s.movimientosCaja.anulado, false), gte(s.movimientosCaja.fecha, desdeTs), lte(s.movimientosCaja.fecha, hastaTs)));
  // Los pases entre efectivo y banco no son ingresos ni egresos del negocio.
  const reales = movs.filter((m) => m.categoria !== "TRANSFERENCIA_INTERNA");
  const categorias = [...new Set(reales.map((m) => `${m.sentido}:${m.categoria}`))].sort();
  const meses = mesesDelAnio(anio).map((periodo) => {
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
  return { meses, categorias };
}
