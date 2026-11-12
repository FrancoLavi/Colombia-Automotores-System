import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import { auditar } from "@/lib/auditoria";
import { r2 } from "@/domain/negocio";
import {
  cajaDelSalon,
  capitalDelInversor,
  conSaldoAcumulado,
  cuentaEnPatrimonio,
  esEditable,
  esManual,
  filtrarDetalle,
  pagoAlInversor,
  exigePersona,
  patrimonioSalon,
  patrimonioTotal,
  resumenPorCategoria,
  saldos,
  ETIQUETA_CATEGORIA,
  MANUALES,
  PIDEN_PERSONA,
  type CategoriaManual,
  type FiltroDetalle,
  type Medio,
  type Sentido,
} from "@/domain/caja";
import { numeroOperacion } from "@/domain/ventas";
import { coincideAuto, opcionesAuto, patentePlana, textoPlano, type FiltroAuto } from "@/domain/autos";
import { ErrorNegocio } from "./errores";
import { cobrarPagoPendiente } from "./ventas";
import { exigirFondos, fotoFondos } from "./fondos";
import { listarStock } from "./vehiculos";

const ENTIDAD = "caja";
type Categoria = (typeof s.movimientosCaja.$inferSelect)["categoria"];

// ---------- Movimientos ----------

export interface FiltrosMovimientos {
  desde?: string;
  hasta?: string;
  medio?: Medio;
  categoria?: string;
  q?: string;
  marca?: string;
  modelo?: string;
  patente?: string;
}

const AUTO = { id: s.vehiculos.id, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, anio: s.vehiculos.anio, dominio: s.vehiculos.dominio };

export async function movimientos(f: FiltrosMovimientos) {
  const cond = [];
  if (f.desde) cond.push(gte(s.movimientosCaja.fecha, new Date(`${f.desde}T00:00:00`)));
  if (f.hasta) cond.push(lte(s.movimientosCaja.fecha, new Date(`${f.hasta}T23:59:59`)));
  if (f.medio) cond.push(eq(s.movimientosCaja.medio, f.medio));
  if (f.categoria) cond.push(eq(s.movimientosCaja.categoria, f.categoria as Categoria));
  if (f.q?.trim()) cond.push(sql`${s.movimientosCaja.concepto} ilike ${"%" + f.q.trim() + "%"}`);
  // Por auto: cada dato con su filtro (marca, modelo, patente sin espacios ni guiones).
  const plano = (col: typeof s.vehiculos.marca | typeof s.vehiculos.modelo) => sql`translate(lower(${col}), 'áéíóúüëñç', 'aeiouuenc')`;
  if (f.marca?.trim()) cond.push(sql`${plano(s.vehiculos.marca)} like ${"%" + textoPlano(f.marca) + "%"}`);
  if (f.modelo?.trim()) cond.push(sql`${plano(s.vehiculos.modelo)} like ${"%" + textoPlano(f.modelo) + "%"}`);
  if (f.patente?.trim()) cond.push(sql`regexp_replace(coalesce(${s.vehiculos.dominio}, ''), '[ .-]', '', 'g') ilike ${"%" + patentePlana(f.patente) + "%"}`);
  const filas = await db
    .select({ m: s.movimientosCaja, usuario: s.usuarios.nombre, auto: AUTO })
    .from(s.movimientosCaja)
    .leftJoin(s.usuarios, eq(s.usuarios.id, s.movimientosCaja.usuarioId))
    .leftJoin(s.vehiculos, eq(s.vehiculos.id, s.movimientosCaja.vehiculoId))
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

/** Marcas y modelos de todos los autos, para sugerir en los filtros. */
/** K1: saldo de cada medio, para las pantallas que solo necesitan eso. */
export async function saldosActuales() {
  const movs = await db
    .select({ sentido: s.movimientosCaja.sentido, medio: s.movimientosCaja.medio, importe: s.movimientosCaja.importe, anulado: s.movimientosCaja.anulado })
    .from(s.movimientosCaja);
  return saldos(movs);
}

export async function opcionesDeAutos() {
  return opcionesAuto(await db.selectDistinct({ marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, dominio: s.vehiculos.dominio }).from(s.vehiculos));
}

/**
 * HU-5.2: de dónde sale un saldo. Todos los movimientos desde el principio (sin el filtro por mes de
 * la planilla), del más viejo al más nuevo, con el saldo acumulado: el último es el de la tarjeta.
 */
export async function detalleSaldo(medio?: Medio, filtro: FiltroDetalle = {}, filtroAuto: FiltroAuto = {}) {
  const filas = await db
    .select({ m: s.movimientosCaja, usuario: s.usuarios.nombre, persona: s.personas.nombre, auto: AUTO })
    .from(s.movimientosCaja)
    .leftJoin(s.usuarios, eq(s.usuarios.id, s.movimientosCaja.usuarioId))
    .leftJoin(s.personas, eq(s.personas.id, s.movimientosCaja.personaId))
    .leftJoin(s.vehiculos, eq(s.vehiculos.id, s.movimientosCaja.vehiculoId))
    .where(medio ? eq(s.movimientosCaja.medio, medio) : undefined)
    .orderBy(asc(s.movimientosCaja.fecha), asc(s.movimientosCaja.id));
  const movs = filas.map((x) => ({ ...x.m, usuario: x.usuario, persona: x.persona, auto: x.auto }));
  // El saldo se acumula sobre todo; el filtro solo elige qué filas mostrar. Los más nuevos, arriba.
  const filtrados = filtrarDetalle(conSaldoAcumulado(movs), filtro).filter((x) => coincideAuto(x.auto, filtroAuto));
  return { movimientos: filtrados.reverse(), resumen: resumenPorCategoria(filtrados), saldos: saldos(movs), autos: movs.map((x) => x.auto) };
}

/** Un movimiento con todo lo que hace falta para entenderlo y llegar al trámite que lo generó. */
export async function fichaMovimiento(id: number) {
  const [x] = await db
    .select({ m: s.movimientosCaja, usuario: s.usuarios.nombre, persona: s.personas.nombre, participe: s.participes.nombre })
    .from(s.movimientosCaja)
    .leftJoin(s.usuarios, eq(s.usuarios.id, s.movimientosCaja.usuarioId))
    .leftJoin(s.personas, eq(s.personas.id, s.movimientosCaja.personaId))
    .leftJoin(s.participes, eq(s.participes.id, s.movimientosCaja.participeId))
    .where(eq(s.movimientosCaja.id, id));
  if (!x) return null;
  const m = x.m;
  const auto = m.vehiculoId ? await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, m.vehiculoId) }) : null;
  const nombreAuto = auto ? `${auto.marca} ${auto.modelo} ${auto.anio}${auto.dominio ? ` (${auto.dominio})` : ""}` : "";
  const gasto = await db.query.gastos.findFirst({
    where: m.cuentaPendienteId ? sql`${s.gastos.movimientoId} = ${id} or ${s.gastos.cuentaPendienteId} = ${m.cuentaPendienteId}` : eq(s.gastos.movimientoId, id),
  });
  const cuenta = m.cuentaPendienteId ? await db.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, m.cuentaPendienteId) }) : null;

  // De dónde salió, del origen más concreto al más general. Ahí es donde se corrige.
  let origen: { texto: string; href: string; ayuda: string } | null = null;
  if (gasto && auto) {
    origen = { texto: `Gasto del auto ${nombreAuto}`, href: `/stock/${auto.id}#gastos`, ayuda: "En la ficha del auto podés eliminar el gasto: el movimiento se anula solo." };
  } else if (m.operacionId) {
    origen = { texto: `Venta ${numeroOperacion(m.operacionId)}${nombreAuto ? ` · ${nombreAuto}` : ""}`, href: `/ventas/${m.operacionId}`, ayuda: "Los cobros, señas y pagos de una venta se corrigen desde la venta." };
  } else if (cuenta) {
    origen = { texto: `Cuenta ${cuenta.tipo === "A_COBRAR" ? "a cobrar" : "a pagar"} con ${cuenta.contraparte}`, href: "/caja/cuentas", ayuda: "Los cobros y pagos de cuentas pendientes se corrigen desde Cuentas pendientes." };
  } else if (auto) {
    origen = { texto: `Auto ${nombreAuto}`, href: `/stock/${auto.id}`, ayuda: "Lo generó la compra o el ingreso del auto: se corrige desde su ficha." };
  }
  const deshacer = await comoSeDeshace(db, m);
  if (deshacer === "INVERSOR") {
    origen = { texto: `Pago al inversor por la venta ${m.operacionId ? numeroOperacion(m.operacionId) : ""}`.trim(), href: "/caja/cuentas#inversores", ayuda: "Si se cargó mal, anulalo acá: vuelve a quedar pendiente en Cuentas pendientes y lo registrás de nuevo." };
  } else if (deshacer === "CUENTA") {
    origen = { ...(origen ?? { texto: "Cuenta pendiente", href: "/caja/cuentas" }), ayuda: "Si se cargó mal, anulalo acá: la cuenta vuelve a quedar abierta y lo registrás de nuevo." };
  }
  return {
    ...m,
    usuario: x.usuario,
    persona: x.persona,
    participe: x.participe,
    origen,
    /** Se puede anular desde su ficha (cargado a mano, o un cobro o pago que vuelve a quedar pendiente). */
    deshacer: m.anulado ? null : deshacer,
    manual: deshacer === "MANUAL",
    editable: esEditable(m.categoria) && deshacer === "MANUAL" && !m.anulado,
  };
}

/** Corrige un movimiento cargado a mano. Los que generó otra operación se corrigen desde su origen. */
export async function editarMovimiento(
  usuarioId: number,
  id: number,
  d: { medio: Medio; importe: number; concepto: string; fecha: Date; personaId: number | null },
) {
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  await db.transaction(async (t) => {
    const antesFondos = await fotoFondos(t); // K13: para comparar al final
    const m = await t.query.movimientosCaja.findFirst({ where: eq(s.movimientosCaja.id, id) });
    if (!m) throw new ErrorNegocio("El movimiento no existe");
    if (m.anulado) throw new ErrorNegocio("El movimiento está anulado");
    if (!esEditable(m.categoria) || (await comoSeDeshace(t, m)) !== "MANUAL") {
      throw new ErrorNegocio(
        m.categoria === "TRANSFERENCIA_INTERNA" ? "Un pase entre efectivo y banco no se edita: anulalo y cargalo de nuevo" : "Este movimiento lo generó otra operación: corregilo desde su origen",
      );
    }
    if (exigePersona(m.categoria) && !d.personaId) throw new ErrorNegocio("Indicá a quién corresponde el sueldo");
    const personaId = (PIDEN_PERSONA as readonly string[]).includes(m.categoria) ? d.personaId : null;
    const [despues] = await t.update(s.movimientosCaja).set({ ...d, personaId }).where(eq(s.movimientosCaja.id, id)).returning();
    await exigirFondos(t, antesFondos);
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes: m, despues, descripcion: `Movimiento corregido: ${d.concepto} · $ ${d.importe.toLocaleString("es-AR")}` });
  });
}

export async function crearMovimiento(
  usuarioId: number,
  d: { categoria: CategoriaManual; sentido: Sentido | null; medio: Medio; importe: number; concepto: string; fecha: Date; participeId: number | null; personaId?: number | null },
) {
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  if (exigePersona(d.categoria) && !d.personaId) throw new ErrorNegocio("Indicá a quién corresponde el sueldo");
  const personaId = (PIDEN_PERSONA as readonly string[]).includes(d.categoria) ? (d.personaId ?? null) : null;
  const sentido = MANUALES[d.categoria] ?? d.sentido;
  if (!sentido) throw new ErrorNegocio("Indicá si el ajuste es ingreso o egreso");
  await db.transaction(async (t) => {
    const antesFondos = await fotoFondos(t); // K13: para comparar al final
    const [m] = await t
      .insert(s.movimientosCaja)
      .values({ fecha: d.fecha, sentido, medio: d.medio, categoria: d.categoria, importe: d.importe, concepto: d.concepto, participeId: d.participeId, personaId, usuarioId })
      .returning();
    await exigirFondos(t, antesFondos);
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: m.id, accion: "CREAR", despues: m, descripcion: `${ETIQUETA_CATEGORIA[d.categoria]}: ${d.concepto} · $ ${d.importe.toLocaleString("es-AR")}` });
  });
}

/** Pase entre efectivo y banco (depósito o extracción): dos movimientos que se compensan. */
export async function transferenciaInterna(usuarioId: number, d: { desde: Medio; importe: number; fecha: Date; concepto: string | null }) {
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  const hacia: Medio = d.desde === "EFECTIVO" ? "BANCO" : "EFECTIVO";
  const concepto = d.concepto ?? (d.desde === "EFECTIVO" ? "Depósito en banco" : "Extracción del banco");
  await db.transaction(async (t) => {
    const antesFondos = await fotoFondos(t); // K13: para comparar al final
    const [a] = await t.insert(s.movimientosCaja).values({ fecha: d.fecha, sentido: "EGRESO", medio: d.desde, categoria: "TRANSFERENCIA_INTERNA", importe: d.importe, concepto, usuarioId }).returning();
    await t.insert(s.movimientosCaja).values({ fecha: d.fecha, sentido: "INGRESO", medio: hacia, categoria: "TRANSFERENCIA_INTERNA", importe: d.importe, concepto, usuarioId });
    await exigirFondos(t, antesFondos);
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: a.id, accion: "CREAR", descripcion: `${concepto} · $ ${d.importe.toLocaleString("es-AR")}` });
  });
}

/**
 * Cómo se deshace un movimiento:
 * - MANUAL: cargado a mano desde Caja; se anula y listo.
 * - CUENTA: un cobro o pago hecho desde Cuentas pendientes; al anularlo la cuenta vuelve a quedar abierta por ese importe.
 * - INVERSOR: lo que se le pagó (o reintegró) un inversor por una venta; vuelve a quedar pendiente.
 * - null: lo generó otra operación (un gasto, una venta, la compra de un auto) y se corrige desde ahí.
 */
export type ComoSeDeshace = "MANUAL" | "CUENTA" | "INVERSOR" | null;

async function comoSeDeshace(t: Tx | typeof db, m: typeof s.movimientosCaja.$inferSelect): Promise<ComoSeDeshace> {
  const [dist] = await t.select({ id: s.distribuciones.id }).from(s.distribuciones).where(eq(s.distribuciones.movimientoId, m.id)).limit(1);
  if (dist) return "INVERSOR";
  if (m.cuentaPendienteId) return "CUENTA";
  return esManual(m.categoria) ? "MANUAL" : null;
}

/**
 * Anula un movimiento sin borrarlo (queda tachado, con el motivo). Si salió de Cuentas pendientes o de
 * un pago a un inversor, lo que se había saldado vuelve a quedar pendiente, así se puede cargar de nuevo
 * con el medio o el importe correctos.
 */
export async function anularMovimiento(usuarioId: number, id: number, motivo: string) {
  await db.transaction(async (t) => {
    const antesFondos = await fotoFondos(t); // K13: para comparar al final
    const m = await t.query.movimientosCaja.findFirst({ where: eq(s.movimientosCaja.id, id) });
    if (!m) throw new ErrorNegocio("El movimiento no existe");
    if (m.anulado) return;
    const como = await comoSeDeshace(t, m);
    if (!como) throw new ErrorNegocio("Este movimiento lo generó otra operación: corregilo desde su origen (gasto, venta o compra del auto)");
    const ids = [id];
    let detalle = "";
    if (m.categoria === "TRANSFERENCIA_INTERNA") {
      // Anula también la contrapartida del pase: el mismo importe y fecha, el otro sentido y el otro medio.
      const par = await t
        .select()
        .from(s.movimientosCaja)
        .where(
          and(
            eq(s.movimientosCaja.categoria, "TRANSFERENCIA_INTERNA"),
            eq(s.movimientosCaja.importe, m.importe),
            eq(s.movimientosCaja.fecha, m.fecha),
            eq(s.movimientosCaja.anulado, false),
            sql`${s.movimientosCaja.medio} <> ${m.medio}`,
            sql`${s.movimientosCaja.sentido} <> ${m.sentido}`,
          ),
        )
        // Las dos patas se cargan juntas: la más cercana por número es la suya.
        .orderBy(sql`abs(${s.movimientosCaja.id} - ${id})`)
        .limit(1);
      ids.push(...par.map((p) => p.id));
    }
    if (como === "INVERSOR") {
      await t.update(s.distribuciones).set({ estado: "PENDIENTE", movimientoId: null }).where(eq(s.distribuciones.movimientoId, id));
      detalle = " · vuelve a quedar pendiente con el inversor";
    }
    if (como === "CUENTA") {
      const c = (await t.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, m.cuentaPendienteId!) }))!;
      await t.update(s.cuentasPendientes).set({ saldo: r2(c.saldo + m.importe), estado: "ABIERTA" }).where(eq(s.cuentasPendientes.id, c.id));
      // Si era el cobro de un pago de una venta (crédito, saldo del cliente), el pago vuelve a pendiente.
      await t.update(s.pagosOperacion).set({ estado: "PENDIENTE", movimientoId: null }).where(eq(s.pagosOperacion.movimientoId, id));
      // Si era el pago de un gasto de un auto, el gasto vuelve a "a pagar".
      await t.update(s.gastos).set({ estado: "PENDIENTE", movimientoId: null }).where(and(eq(s.gastos.movimientoId, id), eq(s.gastos.cuentaPendienteId, c.id)));
      detalle = ` · la cuenta con ${c.contraparte} vuelve a quedar abierta`;
    }
    await t.update(s.movimientosCaja).set({ anulado: true, motivoAnulacion: motivo }).where(inArray(s.movimientosCaja.id, ids));
    await exigirFondos(t, antesFondos);
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "ELIMINAR", antes: m, descripcion: `Anulado: ${m.concepto} (${motivo})${detalle}` });
  });
}

// ---------- Lo que se les debe a los inversores por autos vendidos ----------

/**
 * K5/K10: por venta cerrada, lo que falta pagarle al inversor: su capital y su ganancia.
 * La parte del salón no figura: queda en su caja y los socios la retiran como movimiento (K5).
 * (Ventas cerradas antes de esa regla pueden tener la parte del salón marcada como pendiente: tampoco se muestra.)
 */
export async function pendientesPorPagar() {
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
    .where(and(eq(s.distribuciones.estado, "PENDIENTE"), eq(s.participes.tipo, "INVERSOR")))
    .orderBy(asc(s.operaciones.fechaCierre));
  return filas.map((x) => ({ ...x, numero: numeroOperacion(x.operacionId) }));
}

/** K5/K10: le paga al inversor una sola parte de lo que quedó de una venta (su capital o su ganancia). */
export async function pagarDistribucion(usuarioId: number, id: number, medio: Medio): Promise<number> {
  const d = await db.query.distribuciones.findFirst({ where: eq(s.distribuciones.id, id) });
  if (!d) throw new ErrorNegocio("No existe");
  const ids = await liquidarAlInversor(usuarioId, d.liquidacionId, d.participeId, medio, [id]);
  return ids[0];
}

/**
 * K10/R3: le paga al inversor todo lo que quedó pendiente de una venta, en un paso (ver pagoAlInversor):
 * con ganancia, su capital y su ganancia; con pérdida, el capital menos su mitad de la pérdida, en un
 * solo pago; y si la pérdida supera lo que tenía puesto, registra lo que él le devuelve al salón.
 * Devuelve los movimientos de caja (para el comprobante).
 */
export async function liquidarAlInversor(usuarioId: number, liquidacionId: number, participeId: number, medio: Medio, soloIds?: number[]): Promise<number[]> {
  return db.transaction(async (t) => {
    const antesFondos = await fotoFondos(t); // K13: para comparar al final
    const p = await t.query.participes.findFirst({ where: eq(s.participes.id, participeId) });
    if (!p) throw new ErrorNegocio("No existe");
    if (p.tipo !== "INVERSOR") {
      throw new ErrorNegocio("La ganancia del salón ya está en la caja. Si un socio se lleva plata, cargalo en Caja → Registrar movimiento → Retiro de un socio");
    }
    const todas = await t
      .select()
      .from(s.distribuciones)
      .where(and(eq(s.distribuciones.liquidacionId, liquidacionId), eq(s.distribuciones.participeId, participeId), eq(s.distribuciones.estado, "PENDIENTE")));
    const ds = soloIds ? todas.filter((d) => soloIds.includes(d.id)) : todas;
    if (!ds.length) throw new ErrorNegocio("Ya está pagado");
    const liq = (await t.query.liquidaciones.findFirst({ where: eq(s.liquidaciones.id, liquidacionId) }))!;
    const op = (await t.query.operaciones.findFirst({ where: eq(s.operaciones.id, liq.operacionId) }))!;
    const suma = (tipo: "CAPITAL" | "GANANCIA") => r2(ds.filter((d) => d.tipo === tipo).reduce((a, d) => a + d.importe, 0));
    const capital = suma("CAPITAL");
    const ganancia = suma("GANANCIA");
    const plan = pagoAlInversor(capital, ganancia);
    const venta = numeroOperacion(op.id);
    const conceptoDe = (x: (typeof plan)[number]) => {
      if (x.categoria === "REINTEGRO_INVERSOR") {
        return ganancia < 0
          ? `Reintegro ${venta} · ${p.nombre}: su parte de la pérdida ($ ${(-ganancia).toLocaleString("es-AR")}) supera lo que se le debía`
          : `Reintegro ${venta} · ${p.nombre}: se llevó en usados más de lo que tenía puesto`;
      }
      if (x.salda.length === 2 && ganancia < 0) {
        return `Devolución de capital ${venta} · ${p.nombre}: $ ${capital.toLocaleString("es-AR")} menos su parte de la pérdida $ ${(-ganancia).toLocaleString("es-AR")}`;
      }
      return `${x.categoria === "DEVOLUCION_CAPITAL" ? "Devolución de capital" : "Ganancia"} ${venta} · ${p.nombre}`;
    };
    const movs: number[] = [];
    for (const x of plan) {
      const [m] = await t
        .insert(s.movimientosCaja)
        .values({ sentido: x.sentido, medio, categoria: x.categoria, importe: x.importe, concepto: conceptoDe(x), operacionId: op.id, vehiculoId: op.vehiculoId, participeId: p.id, usuarioId })
        .returning();
      movs.push(m.id);
      const saldadas = ds.filter((d) => x.salda.includes(d.tipo)).map((d) => d.id);
      if (saldadas.length) await t.update(s.distribuciones).set({ estado: "PAGADO", movimientoId: m.id }).where(inArray(s.distribuciones.id, saldadas));
    }
    // Si se compensan justo (capital = su parte de la pérdida), no se mueve plata pero queda saldado.
    if (!plan.length) await t.update(s.distribuciones).set({ estado: "PAGADO" }).where(inArray(s.distribuciones.id, ds.map((d) => d.id)));
    await exigirFondos(t, antesFondos);
    const neto = r2(capital + ganancia);
    await auditar(t, {
      usuarioId, entidad: "operacion", entidadId: op.id, accion: "MODIFICAR",
      descripcion:
        neto < 0
          ? `Reintegro de ${p.nombre}: $ ${(-neto).toLocaleString("es-AR")}`
          : `Pagado a ${p.nombre}: $ ${neto.toLocaleString("es-AR")}${ganancia < 0 ? ` (capital $ ${capital.toLocaleString("es-AR")} menos su parte de la pérdida)` : ""}`,
    });
    return movs;
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

/** HU-5.5/5.6: cobro o pago (total o parcial) de una cuenta pendiente. Devuelve el movimiento de caja (para su comprobante). */
export async function registrarPagoCuenta(usuarioId: number, cuentaId: number, importe: number, medio: Medio): Promise<number> {
  if (!(importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  const c = await db.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, cuentaId) });
  if (!c || c.estado !== "ABIERTA") throw new ErrorNegocio("La cuenta no está abierta");
  if (r2(importe) > r2(c.saldo)) throw new ErrorNegocio(`Supera el saldo de $ ${c.saldo.toLocaleString("es-AR")}`);

  // Si la cuenta salió de un pago de venta (crédito o saldo del cliente), se cobra desde la venta.
  const pago = await db.query.pagosOperacion.findFirst({ where: eq(s.pagosOperacion.cuentaPendienteId, cuentaId) });
  if (pago) {
    if (r2(importe) !== r2(c.saldo)) throw new ErrorNegocio("Los cobros de una venta se registran por el total");
    return cobrarPagoPendiente(usuarioId, pago.operacionId, pago.id, medio);
  }

  return db.transaction(async (t) => {
    const antesFondos = await fotoFondos(t); // K13: para comparar al final
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
    await exigirFondos(t, antesFondos);
    if (gasto && saldo === 0) await t.update(s.gastos).set({ estado: "PAGADO", movimientoId: m.id }).where(eq(s.gastos.id, gasto.id));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: m.id, accion: "CREAR",
      descripcion: `${c.tipo === "A_COBRAR" ? "Cobro" : "Pago"} ${saldo === 0 ? "total" : "parcial"} a ${c.contraparte}: $ ${importe.toLocaleString("es-AR")}`,
    });
    return m.id;
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
      financista: s.participes.tipo,
      valorCompraArs: s.vehiculos.valorCompraArs,
      operacionOrigenId: s.vehiculos.operacionOrigenId,
      tcIngreso: s.vehiculos.tcIngreso,
    })
    .from(s.vehiculos)
    .leftJoin(s.participes, eq(s.participes.id, s.vehiculos.participeId))
    .where(inArray(s.vehiculos.estado, ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"]));
  const ids = autos.map((a) => a.id);
  const gastos = ids.length
    ? await db
        .select({ vehiculoId: s.gastos.vehiculoId, total: sql<number>`coalesce(sum(${s.gastos.importe}), 0)::float`, dueno: sql<number>`coalesce(sum(${s.gastos.importe}) filter (where ${s.gastos.pagadoPor} = 'DUENO'), 0)::float` })
        .from(s.gastos)
        .where(and(inArray(s.gastos.vehiculoId, ids), eq(s.gastos.extraordinario, false)))
        .groupBy(s.gastos.vehiculoId)
    : [];
  const opsOrigen = autos.map((a) => a.operacionOrigenId).filter((x): x is number => x != null);
  const ops = opsOrigen.length ? await db.select({ id: s.operaciones.id, estado: s.operaciones.estado }).from(s.operaciones).where(inArray(s.operaciones.id, opsOrigen)) : [];
  return autos.map((a) => {
    const g = gastos.find((x) => x.vehiculoId === a.id);
    const costo = r2(a.valorCompraArs + (g?.total ?? 0));
    const estadoOperacionOrigen = ops.find((o) => o.id === a.operacionOrigenId)?.estado ?? null;
    /** R8: de los gastos, los que pagó el dueño (inversor o consignante) de su bolsillo. */
    const gastosDelDueno = g?.dueno ?? 0;
    // K9/K10: del costo, lo que puso el inversor (la compra y los gastos que pagó él, R8). El resto lo puso el salón.
    const capitalInversor = capitalDelInversor({ tipoIngreso: a.tipoIngreso, financista: a.financista ?? "SALON", valorCompraArs: a.valorCompraArs, gastosDelDueno });
    return { ...a, costo, gastosDelDueno, capitalInversor, estadoOperacionOrigen, enPatrimonio: cuentaEnPatrimonio({ ...a, costo, estadoOperacionOrigen }) };
  });
}

export async function patrimonio() {
  const [movs, autos, cuentas, pendientes] = await Promise.all([
    db.select({ sentido: s.movimientosCaja.sentido, medio: s.movimientosCaja.medio, importe: s.movimientosCaja.importe, anulado: s.movimientosCaja.anulado }).from(s.movimientosCaja),
    stockConCosto(),
    db.select({ tipo: s.cuentasPendientes.tipo, origen: s.cuentasPendientes.origen, saldo: s.cuentasPendientes.saldo }).from(s.cuentasPendientes).where(eq(s.cuentasPendientes.estado, "ABIERTA")),
    pendientesPorPagar(),
  ]);
  const caja = saldos(movs);
  const propios = autos.filter((a) => a.enPatrimonio);
  const stock = r2(propios.reduce((a, x) => a + x.costo, 0));
  // De ese stock, lo que pusieron los inversores. El resto es del salón: sus propios autos y
  // los gastos que les puso a los autos ajenos.
  const capitalInversores = r2(propios.reduce((a, x) => a + x.capitalInversor, 0));
  const aCobrar = r2(cuentas.filter((c) => c.tipo === "A_COBRAR").reduce((a, c) => a + c.saldo, 0));
  const aPagar = r2(cuentas.filter((c) => c.tipo === "A_PAGAR").reduce((a, c) => a + c.saldo, 0));
  // Capital y ganancias de ventas ya cerradas que todavía no se les pagaron: plata que está en
  // la caja y no es del salón (K11).
  const deudaInversores = r2(pendientes.filter((p) => p.participe.tipo === "INVERSOR").reduce((a, p) => a + p.d.importe, 0));
  // Lo que se le debe al dueño de un auto en consignación ya vendido: también es plata de la caja
  // que no es del salón (K11, S7). Es una cuenta a pagar, así que en el patrimonio ya resta.
  const deudaConsignantes = r2(cuentas.filter((c) => c.tipo === "A_PAGAR" && c.origen === "CONSIGNANTE").reduce((a, c) => a + c.saldo, 0));
  const piezas = { caja: caja.total, stock, capitalInversores, aCobrar, aPagar, deudaInversores };
  const cajaSalon = cajaDelSalon(caja.total, deudaInversores + deudaConsignantes);
  const salon = patrimonioSalon(piezas);
  return {
    caja,
    /** K11: de la caja, lo que es del salón. */
    cajaSalon,
    stock,
    stockInversores: capitalInversores,
    stockSalon: r2(stock - capitalInversores),
    autosEnStock: propios.length,
    consignados: autos.filter((a) => a.tipoIngreso === "CONSIGNACION").length,
    aCobrar,
    aPagar,
    deudaInversores,
    deudaConsignantes,
    /** Plata de la caja que no es del salón: de inversores y consignantes por autos vendidos. */
    ajeno: r2(deudaInversores + deudaConsignantes),
    /** K3: todo lo que hay, sea del salón o de los inversores. */
    total: patrimonioTotal(piezas),
    /** K11: de ese total, lo que es del salón. */
    salon,
    /**
     * Por qué la caja del salón y el patrimonio del salón dan distinto: el patrimonio suma además
     * lo que el salón tiene en autos y lo que le deben, y resta lo que debe a terceros.
     * cajaSalon + autos + aCobrar − aPagar = salon.
     */
    conciliacion: { cajaSalon, autos: r2(stock - capitalInversores), aCobrar, aPagar: r2(aPagar - deudaConsignantes) },
  };
}

/**
 * Desglose de cada número de Patrimonio (K3, K11): los autos uno por uno con su costo, las cuentas
 * abiertas y lo que se les debe a los inversores, para poder rehacer cada total a mano.
 */
export async function desglosePatrimonio() {
  const [p, autos, cuentas, pendientes, participes] = await Promise.all([
    patrimonio(),
    stockConCosto(),
    listarCuentas({}),
    pendientesPorPagar(),
    db.select({ id: s.participes.id, nombre: s.participes.nombre }).from(s.participes),
  ]);
  const nombre = (id: number | null) => participes.find((x) => x.id === id)?.nombre ?? "Salón";
  return {
    p,
    autos: autos
      .filter((a) => a.enPatrimonio)
      .map((a) => ({ ...a, dueno: nombre(a.participeId), gastos: r2(a.costo - a.valorCompraArs), delSalon: r2(a.costo - a.capitalInversor) })),
    consignados: autos.filter((a) => a.tipoIngreso === "CONSIGNACION").length,
    aCobrar: cuentas.filter((c) => c.c.tipo === "A_COBRAR"),
    aPagar: cuentas.filter((c) => c.c.tipo === "A_PAGAR"),
    deInversores: pendientes.filter((g) => g.participe.tipo === "INVERSOR"),
  };
}

/**
 * K6: subcaja por inversor (y por el salón con fondos propios).
 * El inversor ve lo que puso él: el valor de compra de sus autos, sin los gastos que puso el
 * salón (K9). Los autos del salón, en cambio, valen el costo completo.
 */
export async function subcajas() {
  const [participes, autos, dist] = await Promise.all([
    db.select().from(s.participes).where(eq(s.participes.activo, true)).orderBy(asc(s.participes.id)),
    stockConCosto(),
    db
      .select({
        participeId: s.distribuciones.participeId,
        liquidacionId: s.distribuciones.liquidacionId,
        tipo: s.distribuciones.tipo,
        estado: s.distribuciones.estado,
        importe: s.distribuciones.importe,
      })
      .from(s.distribuciones),
  ]);
  return participes.map((p) => {
    const esInversor = p.tipo === "INVERSOR";
    const suyos = autos
      .filter((a) => a.enPatrimonio && a.participeId === p.id)
      .map((a) => ({ ...a, invertido: esInversor ? a.capitalInversor : a.costo }));
    const d = dist.filter((x) => x.participeId === p.id);
    // K5: lo del salón nunca queda pendiente (está en su caja), aunque venga de una venta vieja.
    const pendientes = esInversor ? d.filter((x) => x.estado === "PENDIENTE") : [];
    const suma = (xs: typeof d) => r2(xs.reduce((a, x) => a + x.importe, 0));
    return {
      participe: p,
      autos: suyos,
      capital: r2(suyos.reduce((a, x) => a + x.invertido, 0)),
      capitalUsd: r2(suyos.reduce((a, x) => a + x.invertido / x.tcIngreso, 0)),
      /** K10: capital de autos ya vendidos que todavía no se le devolvió. */
      capitalPorCobrar: suma(pendientes.filter((x) => x.tipo === "CAPITAL")),
      pendiente: suma(pendientes.filter((x) => x.tipo === "GANANCIA")),
      cobrado: suma(d.filter((x) => (x.estado === "PAGADO" || !esInversor) && x.tipo === "GANANCIA")),
      ventas: new Set(d.map((x) => x.liquidacionId)).size,
    };
  });
}

// ---------- Consignaciones ----------

/**
 * S7: autos que dejan clientes en consignación, agrupados por dueño. El dueño pide un monto
 * (el pactado); al vender se le debe eso y todo lo que se saque arriba es del salón. No es un
 * inversor: no pone plata ni cobra ganancia, pero como él, tiene plata en la caja hasta que se le paga.
 */
export async function consignaciones() {
  const { vehiculos } = await listarStock({ estado: "TODOS" });
  const autos = vehiculos.filter((v) => v.tipoIngreso === "CONSIGNACION" && v.estado !== "RECHAZADO");
  const ids = autos.map((a) => a.id);
  const [duenos, cuentas, ventas, gastosDueno] = ids.length
    ? await Promise.all([
        db
          .select({ id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido, telefono: s.contactos.telefono })
          .from(s.contactos)
          .where(inArray(s.contactos.id, autos.map((a) => a.contactoOrigenId).filter((x): x is number => x != null))),
        db
          .select()
          .from(s.cuentasPendientes)
          .where(and(eq(s.cuentasPendientes.origen, "CONSIGNANTE"), inArray(s.cuentasPendientes.vehiculoId, ids))),
        db
          .select({ vehiculoId: s.operaciones.vehiculoId, operacionId: s.operaciones.id, fechaCierre: s.operaciones.fechaCierre, precio: s.liquidaciones.precio, ganancia: s.liquidaciones.ganancia })
          .from(s.operaciones)
          .innerJoin(s.liquidaciones, eq(s.liquidaciones.operacionId, s.operaciones.id))
          .where(and(inArray(s.operaciones.vehiculoId, ids), inArray(s.operaciones.estado, ["CERRADA", "ENTREGADA"]))),
        // R8: los gastos que pagó el dueño de su bolsillo; se le devuelven al vender.
        db
          .select({ vehiculoId: s.gastos.vehiculoId, total: sql<number>`coalesce(sum(${s.gastos.importe}), 0)::float` })
          .from(s.gastos)
          .where(and(inArray(s.gastos.vehiculoId, ids), eq(s.gastos.pagadoPor, "DUENO"), eq(s.gastos.extraordinario, false)))
          .groupBy(s.gastos.vehiculoId),
      ])
    : [[], [], [], []];
  const filas = autos.map((a) => {
    const venta = ventas.find((v) => v.vehiculoId === a.id) ?? null;
    const cuenta = cuentas.find((c) => c.vehiculoId === a.id) ?? null;
    const gastos = r2(a.costo - a.valorCompraArs);
    const gastosDelDueno = gastosDueno.find((g) => g.vehiculoId === a.id)?.total ?? 0;
    return {
      auto: a,
      /** Lo que pidió el dueño (monto pactado). */
      pide: a.valorCompraArs,
      gastos,
      /** R8: de esos gastos, los que pagó el dueño (se le devuelven al vender) y los que puso el salón. */
      gastosDelDueno,
      gastosDelSalon: r2(gastos - gastosDelDueno),
      /** Precio publicado (o sugerido) mientras está en stock; el de venta, si se vendió. */
      precio: venta?.precio ?? a.precio,
      /** Lo que le queda al salón: todo lo que se saque arriba de lo pedido, menos los gastos. */
      paraElSalon: venta ? venta.ganancia : r2(a.precio - a.costo),
      venta: venta ? { ...venta, numero: numeroOperacion(venta.operacionId) } : null,
      /** Lo que todavía se le debe al dueño (si se vendió y no se le pagó todo). */
      seLeDebe: cuenta && cuenta.estado === "ABIERTA" ? cuenta.saldo : 0,
      cuentaId: cuenta?.estado === "ABIERTA" ? cuenta.id : null,
      pagado: cuenta ? r2(cuenta.importe - cuenta.saldo) : 0,
    };
  });
  const grupos = new Map<string, { dueno: (typeof duenos)[number] | null; filas: typeof filas }>();
  for (const f of filas) {
    const clave = String(f.auto.contactoOrigenId ?? "sin");
    if (!grupos.has(clave)) grupos.set(clave, { dueno: duenos.find((d) => d.id === f.auto.contactoOrigenId) ?? null, filas: [] });
    grupos.get(clave)!.filas.push(f);
  }
  const enStock = filas.filter((f) => !f.venta && ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"].includes(f.auto.estado));
  return {
    grupos: [...grupos.values()],
    totales: {
      enStock: enStock.length,
      pedidoEnStock: r2(enStock.reduce((t, f) => t + f.pide, 0)),
      paraElSalonEnStock: r2(enStock.reduce((t, f) => t + f.paraElSalon, 0)),
      seLesDebe: r2(filas.reduce((t, f) => t + f.seLeDebe, 0)),
      ganadoConVendidos: r2(filas.filter((f) => f.venta).reduce((t, f) => t + f.paraElSalon, 0)),
    },
  };
}

/** Lo último que se cobró o pagó desde Cuentas pendientes (cuentas e inversores), para volver a sacar el comprobante. */
export async function ultimosCobrosYPagos(limite = 15) {
  return db
    .select({ m: s.movimientosCaja, auto: AUTO })
    .from(s.movimientosCaja)
    .leftJoin(s.vehiculos, eq(s.vehiculos.id, s.movimientosCaja.vehiculoId))
    .where(
      sql`(${s.movimientosCaja.cuentaPendienteId} is not null or ${s.movimientosCaja.categoria} in ('PAGO_INVERSOR', 'DEVOLUCION_CAPITAL', 'REINTEGRO_INVERSOR') or (${s.movimientosCaja.categoria} = 'AJUSTE' and ${s.movimientosCaja.participeId} is not null))`,
    )
    .orderBy(desc(s.movimientosCaja.fecha), desc(s.movimientosCaja.id))
    .limit(limite);
}
