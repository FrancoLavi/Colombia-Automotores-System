import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import { auditar } from "@/lib/auditoria";
import { hoyIso } from "@/lib/formato";
import { cobertura, costoTotal, liquidar, margenUsd, precioSugerido, r2 } from "@/domain/negocio";
import { ABIERTAS, faltantesParaCerrar, numeroOperacion, seCobraAlRegistrar, validarPagoNuevo, ETIQUETA_PAGO, type EstadoOperacion, type TipoPago } from "@/domain/ventas";
import { ErrorNegocio } from "./errores";
import { crearVehiculo, tcHoy, type DatosVehiculo } from "./vehiculos";

const ENTIDAD = "operacion";
type Medio = "EFECTIVO" | "BANCO";

// ---------- Utilidades internas ----------

async function cargarOperacion(t: Tx, id: number) {
  const op = await t.query.operaciones.findFirst({ where: eq(s.operaciones.id, id) });
  if (!op) throw new ErrorNegocio("La operación no existe");
  return op;
}

async function costoVehiculo(t: Tx | typeof db, vehiculoId: number, valorCompraArs: number) {
  const gastos = await t.select({ importe: s.gastos.importe, extraordinario: s.gastos.extraordinario }).from(s.gastos).where(eq(s.gastos.vehiculoId, vehiculoId));
  return costoTotal(valorCompraArs, gastos);
}

const etiquetaAuto = (v: { marca: string; modelo: string; dominio: string | null }) => `${v.marca} ${v.modelo}${v.dominio ? ` ${v.dominio}` : ""}`;
const nombre = (c: { nombre: string; apellido: string | null }) => `${c.nombre} ${c.apellido ?? ""}`.trim();

/** El contacto pasa a PREVENTA si tiene una operación abierta, o vuelve a DATO / queda CLIENTE si no. */
async function sincronizarEtapa(t: Tx, contactoId: number, usuarioId: number) {
  const c = await t.query.contactos.findFirst({ where: eq(s.contactos.id, contactoId) });
  if (!c) return;
  const ops = await t.select({ estado: s.operaciones.estado }).from(s.operaciones).where(eq(s.operaciones.contactoId, contactoId));
  const etapa = ops.some((o) => ABIERTAS.includes(o.estado))
    ? "PREVENTA"
    : ops.some((o) => o.estado === "CERRADA" || o.estado === "ENTREGADA")
      ? "CLIENTE"
      : c.etapa === "PREVENTA"
        ? "DATO"
        : c.etapa;
  if (etapa === c.etapa) return;
  await t.update(s.contactos).set({ etapa }).where(eq(s.contactos.id, contactoId));
  await auditar(t, { usuarioId, entidad: "contacto", entidadId: contactoId, accion: "CAMBIO_ESTADO", antes: { etapa: c.etapa }, despues: { etapa }, descripcion: `Etapa automática: ${etapa.toLowerCase()}` });
}

async function cambiarEstadoVehiculo(t: Tx, vehiculoId: number, estado: "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "ENTREGADO" | "BAJA", usuarioId: number, motivo: string) {
  const v = await t.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, vehiculoId) });
  if (!v || v.estado === estado) return;
  await t.update(s.vehiculos).set({ estado }).where(eq(s.vehiculos.id, vehiculoId));
  await auditar(t, { usuarioId, entidad: "vehiculo", entidadId: vehiculoId, accion: "CAMBIO_ESTADO", antes: { estado: v.estado }, despues: { estado }, descripcion: motivo });
}

// ---------- Consultas ----------

export async function listarOperaciones(filtro: "ABIERTAS" | "CERRADAS" | "ENTREGADAS" | "CAIDAS" | "TODAS" = "ABIERTAS") {
  const estados: Record<string, EstadoOperacion[]> = {
    ABIERTAS: ["PREVENTA", "SENIADA"],
    CERRADAS: ["CERRADA"],
    ENTREGADAS: ["ENTREGADA"],
    CAIDAS: ["CAIDA"],
    TODAS: ["PREVENTA", "SENIADA", "CERRADA", "ENTREGADA", "CAIDA"],
  };
  const ops = await db
    .select({
      op: s.operaciones,
      contacto: { id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido, telefono: s.contactos.telefono },
      auto: { id: s.vehiculos.id, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, version: s.vehiculos.version, anio: s.vehiculos.anio, dominio: s.vehiculos.dominio },
    })
    .from(s.operaciones)
    .innerJoin(s.contactos, eq(s.contactos.id, s.operaciones.contactoId))
    .innerJoin(s.vehiculos, eq(s.vehiculos.id, s.operaciones.vehiculoId))
    .where(inArray(s.operaciones.estado, estados[filtro]))
    .orderBy(desc(s.operaciones.id));
  const ids = ops.map((o) => o.op.id);
  const pagos = ids.length ? await db.select().from(s.pagosOperacion).where(inArray(s.pagosOperacion.operacionId, ids)) : [];
  const conteo = await db.select({ estado: s.operaciones.estado, n: sql<number>`count(*)::int` }).from(s.operaciones).groupBy(s.operaciones.estado);
  return {
    operaciones: ops.map((o) => {
      const p = pagos.filter((x) => x.operacionId === o.op.id);
      const sena = p.find((x) => x.tipo === "SENIA" && x.estado === "COBRADO" && x.vence);
      return {
        ...o,
        numero: numeroOperacion(o.op.id),
        cobertura: cobertura(o.op.precioVenta, p),
        aCobrar: r2(p.filter((x) => x.estado === "PENDIENTE" && x.tipo !== "PERMUTA").reduce((a, x) => a + x.importe, 0)),
        venceSena: sena?.vence ?? null,
      };
    }),
    conteo: Object.fromEntries(conteo.map((c) => [c.estado, c.n])) as Partial<Record<EstadoOperacion, number>>,
  };
}

export async function fichaOperacion(id: number) {
  const op = await db.query.operaciones.findFirst({ where: eq(s.operaciones.id, id) });
  if (!op) return null;
  const [contacto, v, pagos, liq, historial, tc] = await Promise.all([
    db.query.contactos.findFirst({ where: eq(s.contactos.id, op.contactoId) }),
    db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, op.vehiculoId) }),
    db
      .select({ p: s.pagosOperacion, permuta: { id: s.vehiculos.id, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, anio: s.vehiculos.anio, dominio: s.vehiculos.dominio, estado: s.vehiculos.estado } })
      .from(s.pagosOperacion)
      .leftJoin(s.vehiculos, eq(s.vehiculos.id, s.pagosOperacion.vehiculoPermutaId))
      .where(eq(s.pagosOperacion.operacionId, id))
      .orderBy(asc(s.pagosOperacion.id)),
    db.query.liquidaciones.findFirst({ where: eq(s.liquidaciones.operacionId, id) }),
    db
      .select({ a: s.auditoria, usuario: s.usuarios.nombre })
      .from(s.auditoria)
      .leftJoin(s.usuarios, eq(s.usuarios.id, s.auditoria.usuarioId))
      .where(and(eq(s.auditoria.entidad, ENTIDAD), eq(s.auditoria.entidadId, id)))
      .orderBy(desc(s.auditoria.fecha), desc(s.auditoria.id)),
    tcHoy(),
  ]);
  if (!contacto || !v) return null;
  const financista = await db.query.participes.findFirst({ where: eq(s.participes.id, liq?.participeId ?? v.participeId) });
  const distribuciones = liq
    ? await db
        .select({ d: s.distribuciones, participe: s.participes.nombre, tipo: s.participes.tipo })
        .from(s.distribuciones)
        .innerJoin(s.participes, eq(s.participes.id, s.distribuciones.participeId))
        .where(eq(s.distribuciones.liquidacionId, liq.id))
    : [];

  // Liquidación prevista (antes del cierre) con el costo actual del auto.
  const costo = liq?.costo ?? (await costoVehiculo(db, v.id, v.valorCompraArs));
  const prevista = liquidar({ costo, precio: op.precioVenta, financista: financista?.tipo ?? "SALON", tipoIngreso: v.tipoIngreso });
  const tcRef = op.tcVenta ?? tc?.valor ?? null;
  const usd = tcRef ? margenUsd(op.precioVenta, costo, v.tcIngreso, tcRef) : null;

  return {
    op,
    numero: numeroOperacion(op.id),
    contacto,
    v,
    financista,
    pagos,
    cobertura: cobertura(op.precioVenta, pagos.map((x) => x.p)),
    faltantes: faltantesParaCerrar(op.estado, op.precioVenta, pagos.map((x) => x.p), v.estado),
    liquidacion: liq ?? null,
    distribuciones,
    prevista,
    usd,
    tcRef,
    historial,
  };
}

export async function datosNuevaVenta() {
  const [contactos, vehiculos] = await Promise.all([
    db
      .select({ id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido, telefono: s.contactos.telefono, etapa: s.contactos.etapa })
      .from(s.contactos)
      .where(ne(s.contactos.etapa, "DESCARTADO"))
      .orderBy(asc(s.contactos.nombre)),
    db.select().from(s.vehiculos).where(eq(s.vehiculos.estado, "DISPONIBLE")).orderBy(asc(s.vehiculos.marca), asc(s.vehiculos.modelo)),
  ]);
  const conPrecio = await Promise.all(
    vehiculos.map(async (v) => ({
      id: v.id,
      etiqueta: `${v.marca} ${v.modelo} ${v.version ?? ""} ${v.anio}${v.dominio ? ` · ${v.dominio}` : ""}`.replace(/\s+/g, " "),
      precio: v.precioPublicado ?? precioSugerido(await costoVehiculo(db, v.id, v.valorCompraArs), v.ajustePrecio),
      participeId: v.participeId,
    })),
  );
  return { contactos, vehiculos: conPrecio };
}

export async function operacionesDeContacto(contactoId: number) {
  const ops = await db
    .select({ op: s.operaciones, auto: { marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, anio: s.vehiculos.anio } })
    .from(s.operaciones)
    .innerJoin(s.vehiculos, eq(s.vehiculos.id, s.operaciones.vehiculoId))
    .where(eq(s.operaciones.contactoId, contactoId))
    .orderBy(desc(s.operaciones.id));
  return ops.map((o) => ({ ...o, numero: numeroOperacion(o.op.id) }));
}

export async function operacionAbiertaDeVehiculo(vehiculoId: number) {
  const op = await db.query.operaciones.findFirst({
    where: and(eq(s.operaciones.vehiculoId, vehiculoId), inArray(s.operaciones.estado, ["PREVENTA", "SENIADA", "CERRADA", "ENTREGADA"])),
    orderBy: desc(s.operaciones.id),
  });
  return op ? { id: op.id, numero: numeroOperacion(op.id), estado: op.estado } : null;
}

// ---------- Ciclo de la operación ----------

export async function crearOperacion(usuarioId: number, d: { contactoId: number; vehiculoId: number; precioVenta: number; observaciones: string | null }) {
  if (!(d.precioVenta > 0)) throw new ErrorNegocio("Indicá el precio de venta");
  return db.transaction(async (t) => {
    const v = await t.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, d.vehiculoId) });
    if (!v) throw new ErrorNegocio("El auto no existe");
    if (v.estado !== "DISPONIBLE") throw new ErrorNegocio(`El auto no está disponible (está ${v.estado.toLowerCase().replace("_", " ")})`);
    const c = await t.query.contactos.findFirst({ where: eq(s.contactos.id, d.contactoId) });
    if (!c) throw new ErrorNegocio("El contacto no existe");
    const [op] = await t
      .insert(s.operaciones)
      .values({ ...d, vendedorId: usuarioId, estado: "PREVENTA", fechaPreventa: hoyIso() })
      .returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: op.id, accion: "CREAR", despues: op, descripcion: `Preventa: ${nombre(c)} · ${etiquetaAuto(v)}` });
    await sincronizarEtapa(t, c.id, usuarioId);
    return op.id;
  });
}

export async function cambiarPrecio(usuarioId: number, id: number, precioVenta: number, observaciones: string | null) {
  await db.transaction(async (t) => {
    const op = await cargarOperacion(t, id);
    if (!ABIERTAS.includes(op.estado)) throw new ErrorNegocio("Solo se puede cambiar el precio antes de cerrar");
    const pagos = await t.select().from(s.pagosOperacion).where(eq(s.pagosOperacion.operacionId, id));
    if (cobertura(precioVenta, pagos).cubierto > precioVenta) throw new ErrorNegocio("Los pagos cargados superan el nuevo precio");
    await t.update(s.operaciones).set({ precioVenta, observaciones }).where(eq(s.operaciones.id, id));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes: { precioVenta: op.precioVenta, observaciones: op.observaciones }, despues: { precioVenta, observaciones }, descripcion: "Precio u observaciones modificados" });
  });
}

export interface PagoNuevo {
  tipo: Exclude<TipoPago, "PERMUTA">;
  importe: number;
  fecha: string;
  medio: Medio;
  banco: string | null;
  vence: string | null;
  cobradoAhora: boolean;
}

/** S3/S4: seña, efectivo, transferencia, crédito u otro. La seña reserva el auto. */
export async function agregarPago(usuarioId: number, id: number, p: PagoNuevo) {
  await db.transaction(async (t) => {
    const op = await cargarOperacion(t, id);
    if (!ABIERTAS.includes(op.estado)) throw new ErrorNegocio("La operación ya está cerrada o caída");
    const pagos = await t.select().from(s.pagosOperacion).where(eq(s.pagosOperacion.operacionId, id));
    const error = validarPagoNuevo(op.precioVenta, pagos, p.importe);
    if (error) throw new ErrorNegocio(error);
    if (p.tipo === "CREDITO" && !p.banco) throw new ErrorNegocio("Indicá el banco del crédito");
    const v = (await t.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, op.vehiculoId) }))!;
    const c = (await t.query.contactos.findFirst({ where: eq(s.contactos.id, op.contactoId) }))!;

    const cobrado = seCobraAlRegistrar(p.tipo, p.cobradoAhora);
    const medio: Medio = p.tipo === "TRANSFERENCIA" ? "BANCO" : p.medio;
    let movimientoId: number | null = null;
    if (cobrado) {
      const [m] = await t
        .insert(s.movimientosCaja)
        .values({
          sentido: "INGRESO",
          medio,
          categoria: p.tipo === "SENIA" ? "SENIA" : "COBRO_VENTA",
          importe: p.importe,
          concepto: `${ETIQUETA_PAGO[p.tipo]} ${numeroOperacion(id)} · ${nombre(c)} · ${etiquetaAuto(v)}`,
          operacionId: id,
          vehiculoId: v.id,
          usuarioId,
        })
        .returning();
      movimientoId = m.id;
    }
    await t.insert(s.pagosOperacion).values({
      operacionId: id,
      tipo: p.tipo,
      importe: p.importe,
      fecha: p.fecha,
      medio: p.tipo === "CREDITO" ? null : medio,
      banco: p.banco,
      vence: p.tipo === "SENIA" ? p.vence : null,
      estado: cobrado ? "COBRADO" : "PENDIENTE",
      movimientoId,
    });
    if (p.tipo === "SENIA" && op.estado === "PREVENTA") {
      await t.update(s.operaciones).set({ estado: "SENIADA" }).where(eq(s.operaciones.id, id));
      await cambiarEstadoVehiculo(t, v.id, "RESERVADO", usuarioId, `Reservado por seña (${numeroOperacion(id)})`);
    }
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CREAR",
      descripcion: `${ETIQUETA_PAGO[p.tipo]} $ ${p.importe.toLocaleString("es-AR")}${p.banco ? ` (${p.banco})` : ""}${cobrado ? " · cobrado" : " · a cobrar"}`,
    });
  });
}

/** HU-4.4: toma un usado como parte de pago. Crea el auto POR_INGRESAR y el pago tipo PERMUTA (no pasa por caja). */
export async function tomarUsado(usuarioId: number, id: number, datos: Omit<DatosVehiculo, "tipoIngreso" | "contactoOrigenId">) {
  return db.transaction(async (t) => {
    const op = await cargarOperacion(t, id);
    if (!ABIERTAS.includes(op.estado)) throw new ErrorNegocio("La operación ya está cerrada o caída");
    const pagos = await t.select().from(s.pagosOperacion).where(eq(s.pagosOperacion.operacionId, id));
    const valorArs = datos.monedaCompra === "USD" ? r2(datos.valorCompra * datos.tcIngreso) : datos.valorCompra;
    const error = validarPagoNuevo(op.precioVenta, pagos, valorArs);
    if (error) throw new ErrorNegocio(error);
    const vehiculoId = await crearVehiculo(usuarioId, { ...datos, tipoIngreso: "PERMUTA", contactoOrigenId: op.contactoId }, { modo: "SIN_REGISTRO" }, t);
    await t.update(s.vehiculos).set({ operacionOrigenId: id }).where(eq(s.vehiculos.id, vehiculoId));
    await t.insert(s.pagosOperacion).values({ operacionId: id, tipo: "PERMUTA", importe: valorArs, fecha: hoyIso(), vehiculoPermutaId: vehiculoId, estado: "PENDIENTE" });
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CREAR", descripcion: `Toma de usado ${datos.marca} ${datos.modelo} ${datos.anio} por $ ${valorArs.toLocaleString("es-AR")}` });
    return vehiculoId;
  });
}

/** Quita un pago antes del cierre. Si ya había entrado a caja, se anula el movimiento. La permuta da de baja el usado. */
export async function quitarPago(usuarioId: number, id: number, pagoId: number) {
  await db.transaction(async (t) => {
    const op = await cargarOperacion(t, id);
    if (!ABIERTAS.includes(op.estado)) throw new ErrorNegocio("No se pueden quitar pagos de una operación cerrada");
    const p = await t.query.pagosOperacion.findFirst({ where: and(eq(s.pagosOperacion.id, pagoId), eq(s.pagosOperacion.operacionId, id)) });
    if (!p) throw new ErrorNegocio("El pago no existe");
    if (p.estado === "DEVUELTA" || p.estado === "RETENIDA") throw new ErrorNegocio("Ese pago ya fue resuelto");
    if (p.movimientoId) await t.update(s.movimientosCaja).set({ anulado: true, motivoAnulacion: `Pago quitado de ${numeroOperacion(id)}` }).where(eq(s.movimientosCaja.id, p.movimientoId));
    if (p.vehiculoPermutaId) await cambiarEstadoVehiculo(t, p.vehiculoPermutaId, "BAJA", usuarioId, `Permuta quitada de ${numeroOperacion(id)}`);
    await t.delete(s.pagosOperacion).where(eq(s.pagosOperacion.id, pagoId));
    // Sin señas vigentes, la operación vuelve a preventa y el auto a disponible.
    const quedan = await t.select().from(s.pagosOperacion).where(and(eq(s.pagosOperacion.operacionId, id), eq(s.pagosOperacion.tipo, "SENIA"), eq(s.pagosOperacion.estado, "COBRADO")));
    if (op.estado === "SENIADA" && !quedan.length) {
      await t.update(s.operaciones).set({ estado: "PREVENTA" }).where(eq(s.operaciones.id, id));
      await cambiarEstadoVehiculo(t, op.vehiculoId, "DISPONIBLE", usuarioId, `Sin seña (${numeroOperacion(id)})`);
    }
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "ELIMINAR", antes: p, descripcion: `Quitó ${ETIQUETA_PAGO[p.tipo].toLowerCase()} $ ${p.importe.toLocaleString("es-AR")}${p.movimientoId ? " (movimiento de caja anulado)" : ""}` });
  });
}

/** S5: cierra la venta, congela la liquidación y genera reparto, cuentas a cobrar y a pagar. */
export async function cerrarOperacion(usuarioId: number, id: number, tcVenta: number | null) {
  await db.transaction(async (t) => {
    const op = await cargarOperacion(t, id);
    const v = (await t.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, op.vehiculoId) }))!;
    const c = (await t.query.contactos.findFirst({ where: eq(s.contactos.id, op.contactoId) }))!;
    const pagos = await t.select().from(s.pagosOperacion).where(eq(s.pagosOperacion.operacionId, id));
    const faltan = faltantesParaCerrar(op.estado, op.precioVenta, pagos, v.estado);
    if (faltan.length) throw new ErrorNegocio(faltan.join(" · "));

    const financista = (await t.query.participes.findFirst({ where: eq(s.participes.id, v.participeId) }))!;
    const costo = await costoVehiculo(t, v.id, v.valorCompraArs);
    const l = liquidar({ costo, precio: op.precioVenta, financista: financista.tipo, tipoIngreso: v.tipoIngreso });
    const [liq] = await t
      .insert(s.liquidaciones)
      .values({
        operacionId: id,
        participeId: financista.id,
        regla: l.regla,
        costo: l.costo,
        precio: l.precio,
        ganancia: l.ganancia,
        gananciaBase: l.gananciaBase,
        sobreprecio: l.sobreprecio,
        parteInversor: l.parteInversor,
        parteSalon: l.parteSalon,
        tcIngreso: v.tcIngreso,
        tcVenta,
        costoUsd: r2(costo / v.tcIngreso),
        ventaUsd: tcVenta ? r2(op.precioVenta / tcVenta) : null,
      })
      .returning();

    const salon = (await t.query.participes.findFirst({ where: eq(s.participes.tipo, "SALON") }))!;
    const reparto = [
      { participeId: financista.id, importe: l.parteInversor, inversor: true },
      { participeId: salon.id, importe: l.parteSalon, inversor: false },
    ].filter((x) => x.importe !== 0 && (x.inversor ? financista.tipo === "INVERSOR" : true));
    if (reparto.length) await t.insert(s.distribuciones).values(reparto.map((x) => ({ liquidacionId: liq.id, participeId: x.participeId, importe: x.importe })));

    // Lo que no entró a caja queda a cobrar (crédito bancario o saldo del cliente). La permuta ya es stock.
    for (const p of pagos) {
      if (p.estado !== "PENDIENTE") continue;
      if (p.tipo === "PERMUTA") {
        await t.update(s.pagosOperacion).set({ estado: "COBRADO" }).where(eq(s.pagosOperacion.id, p.id));
        continue;
      }
      const [cta] = await t
        .insert(s.cuentasPendientes)
        .values({
          tipo: "A_COBRAR",
          origen: p.tipo === "CREDITO" ? "CREDITO_BANCARIO" : "MANUAL",
          contraparte: p.tipo === "CREDITO" ? `Banco ${p.banco ?? ""}`.trim() : nombre(c),
          contactoId: c.id,
          vehiculoId: v.id,
          operacionId: id,
          importe: p.importe,
          saldo: p.importe,
          notas: `${ETIQUETA_PAGO[p.tipo]} ${numeroOperacion(id)}`,
        })
        .returning();
      await t.update(s.pagosOperacion).set({ cuentaPendienteId: cta.id }).where(eq(s.pagosOperacion.id, p.id));
    }

    // S7: consignación → se le debe al dueño el monto pactado.
    if (v.tipoIngreso === "CONSIGNACION") {
      const duenio = v.contactoOrigenId ? await t.query.contactos.findFirst({ where: eq(s.contactos.id, v.contactoOrigenId) }) : null;
      await t.insert(s.cuentasPendientes).values({
        tipo: "A_PAGAR",
        origen: "CONSIGNANTE",
        contraparte: duenio ? nombre(duenio) : "Dueño (consignación)",
        contactoId: v.contactoOrigenId,
        vehiculoId: v.id,
        operacionId: id,
        importe: v.valorCompraArs,
        saldo: v.valorCompraArs,
        notas: `Consignación ${etiquetaAuto(v)} · ${numeroOperacion(id)}`,
      });
    }

    await t.update(s.operaciones).set({ estado: "CERRADA", fechaCierre: hoyIso(), tcVenta }).where(eq(s.operaciones.id, id));
    await cambiarEstadoVehiculo(t, v.id, "VENDIDO", usuarioId, `Vendido (${numeroOperacion(id)})`);
    await sincronizarEtapa(t, c.id, usuarioId);
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO",
      antes: { estado: op.estado }, despues: { estado: "CERRADA" },
      descripcion: `Venta cerrada · ganancia $ ${l.ganancia.toLocaleString("es-AR")} (${l.regla === "INVERSOR_BASE" ? "7,5 % inversor" : l.regla === "INVERSOR_MITADES" ? "mitad y mitad" : "100 % salón"})`,
    });
  });
}

/** S6: entrega con fecha y hora (desde ahí multas y patentes son del comprador). */
export async function entregarOperacion(usuarioId: number, id: number, fechaEntrega: Date) {
  await db.transaction(async (t) => {
    const op = await cargarOperacion(t, id);
    if (op.estado !== "CERRADA") throw new ErrorNegocio("Solo se entregan operaciones cerradas");
    await t.update(s.operaciones).set({ estado: "ENTREGADA", fechaEntrega }).where(eq(s.operaciones.id, id));
    await cambiarEstadoVehiculo(t, op.vehiculoId, "ENTREGADO", usuarioId, `Entregado (${numeroOperacion(id)})`);
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO", antes: { estado: op.estado }, despues: { estado: "ENTREGADA", fechaEntrega },
      descripcion: `Entregado el ${fechaEntrega.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    });
  });
}

/** S3: la operación se cae. La seña se devuelve (egreso) o queda para el salón; los demás cobros se devuelven. */
export async function caerOperacion(usuarioId: number, id: number, motivo: string, sena: "DEVOLVER" | "RETENER", medio: Medio) {
  await db.transaction(async (t) => {
    const op = await cargarOperacion(t, id);
    if (!ABIERTAS.includes(op.estado)) throw new ErrorNegocio("Solo se pueden dar de baja operaciones abiertas");
    const pagos = await t.select().from(s.pagosOperacion).where(eq(s.pagosOperacion.operacionId, id));
    const c = (await t.query.contactos.findFirst({ where: eq(s.contactos.id, op.contactoId) }))!;
    let devuelto = 0;
    for (const p of pagos) {
      if (p.tipo === "PERMUTA" && p.vehiculoPermutaId) {
        await cambiarEstadoVehiculo(t, p.vehiculoPermutaId, "BAJA", usuarioId, `Operación caída (${numeroOperacion(id)})`);
        await t.update(s.pagosOperacion).set({ estado: "DEVUELTA" }).where(eq(s.pagosOperacion.id, p.id));
        continue;
      }
      if (p.estado !== "COBRADO") {
        await t.update(s.pagosOperacion).set({ estado: "DEVUELTA" }).where(eq(s.pagosOperacion.id, p.id));
        continue;
      }
      if (p.tipo === "SENIA" && sena === "RETENER") {
        await t.update(s.pagosOperacion).set({ estado: "RETENIDA" }).where(eq(s.pagosOperacion.id, p.id));
        continue;
      }
      await t.insert(s.movimientosCaja).values({
        sentido: "EGRESO",
        medio,
        categoria: "DEVOLUCION_SENIA",
        importe: p.importe,
        concepto: `Devolución ${ETIQUETA_PAGO[p.tipo].toLowerCase()} ${numeroOperacion(id)} · ${nombre(c)}`,
        operacionId: id,
        vehiculoId: op.vehiculoId,
        usuarioId,
      });
      await t.update(s.pagosOperacion).set({ estado: "DEVUELTA" }).where(eq(s.pagosOperacion.id, p.id));
      devuelto += p.importe;
    }
    await t.update(s.operaciones).set({ estado: "CAIDA", motivoCaida: motivo }).where(eq(s.operaciones.id, id));
    await cambiarEstadoVehiculo(t, op.vehiculoId, "DISPONIBLE", usuarioId, `Liberado: operación caída (${numeroOperacion(id)})`);
    await sincronizarEtapa(t, c.id, usuarioId);
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO", antes: { estado: op.estado }, despues: { estado: "CAIDA" },
      descripcion: `Operación caída: ${motivo}${devuelto ? ` · devuelto $ ${devuelto.toLocaleString("es-AR")}` : ""}${sena === "RETENER" && pagos.some((p) => p.tipo === "SENIA" && p.estado === "COBRADO") ? " · seña retenida" : ""}`,
    });
  });
}

/** Cobra un pago que quedó pendiente al cerrar (crédito liquidado por el banco o saldo del cliente). */
export async function cobrarPagoPendiente(usuarioId: number, id: number, pagoId: number, medio: Medio) {
  await db.transaction(async (t) => {
    const op = await cargarOperacion(t, id);
    const p = await t.query.pagosOperacion.findFirst({ where: and(eq(s.pagosOperacion.id, pagoId), eq(s.pagosOperacion.operacionId, id)) });
    if (!p || p.estado !== "PENDIENTE" || p.tipo === "PERMUTA") throw new ErrorNegocio("Ese pago no está pendiente de cobro");
    if (ABIERTAS.includes(op.estado) && p.tipo === "CREDITO") throw new ErrorNegocio("El crédito se cobra después de cerrar la venta");
    const c = (await t.query.contactos.findFirst({ where: eq(s.contactos.id, op.contactoId) }))!;
    const [m] = await t
      .insert(s.movimientosCaja)
      .values({
        sentido: "INGRESO",
        medio: p.tipo === "CREDITO" || p.tipo === "TRANSFERENCIA" ? "BANCO" : medio,
        categoria: p.tipo === "CREDITO" ? "COBRO_CREDITO" : "COBRO_VENTA",
        importe: p.importe,
        concepto: `${ETIQUETA_PAGO[p.tipo]} ${numeroOperacion(id)} · ${p.tipo === "CREDITO" ? `Banco ${p.banco ?? ""}` : nombre(c)}`,
        operacionId: id,
        vehiculoId: op.vehiculoId,
        cuentaPendienteId: p.cuentaPendienteId,
        usuarioId,
      })
      .returning();
    await t.update(s.pagosOperacion).set({ estado: "COBRADO", movimientoId: m.id }).where(eq(s.pagosOperacion.id, pagoId));
    if (p.cuentaPendienteId) await t.update(s.cuentasPendientes).set({ saldo: 0, estado: "CANCELADA" }).where(eq(s.cuentasPendientes.id, p.cuentaPendienteId));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", descripcion: `Cobrado: ${ETIQUETA_PAGO[p.tipo].toLowerCase()} $ ${p.importe.toLocaleString("es-AR")}` });
  });
}
