import "server-only";
import { and, asc, desc, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import { auditar } from "@/lib/auditoria";
import { coincidePedido, etapasManuales, normalizarTelefono, ETIQUETA_ETAPA, type Etapa, type Origen, type TipoActividad } from "@/domain/contactos";
import { ErrorNegocio } from "./errores";
import { listarStock } from "./vehiculos";

const ENTIDAD = "contacto";

export interface DatosContacto {
  nombre: string;
  apellido: string | null;
  dniCuit: string | null;
  telefono: string | null;
  email: string | null;
  localidad: string | null;
  origen: Origen;
  calificacionMonto: number | null;
  calificacionBanco: string | null;
  productoInteres: string | null;
  usadoAEntregar: string | null;
  observaciones: string | null;
  proximoContacto: string | null;
}

const nombreCompleto = (c: { nombre: string; apellido: string | null }) => `${c.nombre} ${c.apellido ?? ""}`.trim();

// ---------- Consultas ----------

/** Contacto con el mismo teléfono (normalizado), para avisar duplicados. */
export async function buscarPorTelefono(telefono: string | null, excluirId?: number, ex: Tx | typeof db = db) {
  const n = normalizarTelefono(telefono);
  if (!n || n.length < 6) return null;
  const candidatos = await ex
    .select({ id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido, telefono: s.contactos.telefono })
    .from(s.contactos)
    .where(sql`regexp_replace(coalesce(${s.contactos.telefono}, ''), '\\D', '', 'g') like ${"%" + n.slice(-8)}`);
  return candidatos.find((c) => c.id !== excluirId && normalizarTelefono(c.telefono) === n) ?? null;
}

export async function listarContactos(f: { q?: string; etapa?: string; origen?: string }) {
  const cond = [];
  if (f.etapa) cond.push(eq(s.contactos.etapa, f.etapa as Etapa));
  if (f.origen) cond.push(eq(s.contactos.origen, f.origen as Origen));
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    const digitos = f.q.replace(/\D/g, "");
    cond.push(
      or(
        sql`${s.contactos.nombre} ilike ${q}`,
        sql`${s.contactos.apellido} ilike ${q}`,
        sql`${s.contactos.productoInteres} ilike ${q}`,
        sql`${s.contactos.localidad} ilike ${q}`,
        digitos.length >= 4 ? sql`regexp_replace(coalesce(${s.contactos.telefono}, ''), '\\D', '', 'g') like ${"%" + digitos + "%"}` : sql`false`,
      )!,
    );
  }
  const contactos = await db
    .select()
    .from(s.contactos)
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(sql`${s.contactos.proximoContacto} asc nulls last`, desc(s.contactos.creadoEn))
    .limit(300);
  const conteo = await db.select({ etapa: s.contactos.etapa, n: sql<number>`count(*)::int` }).from(s.contactos).groupBy(s.contactos.etapa);
  return { contactos, conteo: Object.fromEntries(conteo.map((c) => [c.etapa, c.n])) as Partial<Record<Etapa, number>> };
}

/** Autos en stock (disponibles o por ingresar) con su precio, para cruzar con pedidos. */
async function autosParaPedidos() {
  const { vehiculos } = await listarStock({ estado: "ACTIVOS" });
  return vehiculos.filter((v) => v.estado === "DISPONIBLE" || v.estado === "POR_INGRESAR");
}

export async function fichaContacto(id: number) {
  const c = await db.query.contactos.findFirst({ where: eq(s.contactos.id, id) });
  if (!c) return null;
  const [actividades, pedidos, autosTraidos, historial, autos] = await Promise.all([
    db
      .select({ a: s.actividades, usuario: s.usuarios.nombre })
      .from(s.actividades)
      .leftJoin(s.usuarios, eq(s.usuarios.id, s.actividades.usuarioId))
      .where(eq(s.actividades.contactoId, id))
      .orderBy(desc(s.actividades.fechaProgramada)),
    db.select().from(s.pedidos).where(eq(s.pedidos.contactoId, id)).orderBy(desc(s.pedidos.creadoEn)),
    db
      .select({ id: s.vehiculos.id, dominio: s.vehiculos.dominio, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, anio: s.vehiculos.anio, tipoIngreso: s.vehiculos.tipoIngreso, estado: s.vehiculos.estado })
      .from(s.vehiculos)
      .where(eq(s.vehiculos.contactoOrigenId, id)),
    db
      .select({ a: s.auditoria, usuario: s.usuarios.nombre })
      .from(s.auditoria)
      .leftJoin(s.usuarios, eq(s.usuarios.id, s.auditoria.usuarioId))
      .where(and(eq(s.auditoria.entidad, ENTIDAD), eq(s.auditoria.entidadId, id)))
      .orderBy(desc(s.auditoria.fecha), desc(s.auditoria.id))
      .limit(30),
    autosParaPedidos(),
  ]);
  const pedidosConAutos = pedidos.map((p) => ({ ...p, coincidencias: p.estado === "ABIERTO" ? autos.filter((a) => coincidePedido(p, a)) : [] }));
  return { c, actividades, pedidos: pedidosConAutos, autosTraidos, historial, etapasManuales: etapasManuales(c.etapa) };
}

/** Pedidos abiertos de todos los contactos, con los autos del stock que coinciden. */
export async function pedidosAbiertos() {
  const [pedidos, autos] = await Promise.all([
    db
      .select({ p: s.pedidos, contacto: { id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido, telefono: s.contactos.telefono } })
      .from(s.pedidos)
      .innerJoin(s.contactos, eq(s.contactos.id, s.pedidos.contactoId))
      .where(eq(s.pedidos.estado, "ABIERTO"))
      .orderBy(desc(s.pedidos.creadoEn)),
    autosParaPedidos(),
  ]);
  return pedidos.map(({ p, contacto }) => ({ ...p, contacto, coincidencias: autos.filter((a) => coincidePedido(p, a)) }));
}

/** Contactos con pedidos abiertos que coinciden con un auto (para la ficha del auto). */
export async function interesadosEnAuto(auto: { marca: string; modelo: string; version: string | null; anio: number; precio: number }) {
  const pedidos = await db
    .select({ p: s.pedidos, contacto: { id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido, telefono: s.contactos.telefono } })
    .from(s.pedidos)
    .innerJoin(s.contactos, eq(s.contactos.id, s.pedidos.contactoId))
    .where(eq(s.pedidos.estado, "ABIERTO"));
  return pedidos.filter(({ p }) => coincidePedido(p, auto)).map(({ p, contacto }) => ({ pedidoId: p.id, contacto }));
}

/**
 * HU-2.3: agenda. Actividades programadas sin realizar hasta `hasta` (incluye atrasadas)
 * y contactos cuyo "próximo contacto" cae en el rango.
 */
export async function agenda(hasta: string) {
  const finDia = new Date(`${hasta}T23:59:59`);
  const [actividades, proximos] = await Promise.all([
    db
      .select({ a: s.actividades, contacto: { id: s.contactos.id, nombre: s.contactos.nombre, apellido: s.contactos.apellido, telefono: s.contactos.telefono } })
      .from(s.actividades)
      .innerJoin(s.contactos, eq(s.contactos.id, s.actividades.contactoId))
      .where(and(isNull(s.actividades.realizadaEn), lte(s.actividades.fechaProgramada, finDia)))
      .orderBy(asc(s.actividades.fechaProgramada)),
    db
      .select()
      .from(s.contactos)
      .where(and(lte(s.contactos.proximoContacto, hasta), ne(s.contactos.etapa, "DESCARTADO")))
      .orderBy(asc(s.contactos.proximoContacto)),
  ]);
  // Si un contacto ya tiene una actividad pendiente, no se repite por su "próximo contacto".
  const conActividad = new Set(actividades.map((x) => x.contacto.id));
  return { actividades, proximos: proximos.filter((c) => !conActividad.has(c.id)) };
}

export async function contarAgenda(hasta: string) {
  const r = await agenda(hasta);
  return r.actividades.length + r.proximos.length;
}

// ---------- Altas y modificaciones ----------

export async function crearContacto(usuarioId: number, d: DatosContacto, opts: { ignorarDuplicado?: boolean } = {}) {
  if (!d.nombre.trim()) throw new ErrorNegocio("Completá el nombre");
  return db.transaction(async (t) => {
    if (!opts.ignorarDuplicado) {
      const dup = await buscarPorTelefono(d.telefono, undefined, t);
      if (dup) throw new ErrorNegocio(`Ya existe un contacto con ese teléfono: ${nombreCompleto(dup)} (#${dup.id})`);
    }
    const [c] = await t.insert(s.contactos).values({ ...d, creadoPor: usuarioId }).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: c.id, accion: "CREAR", despues: c, descripcion: "Alta del contacto" });
    return c.id;
  });
}

export async function actualizarContacto(usuarioId: number, id: number, d: DatosContacto) {
  await db.transaction(async (t) => {
    const antes = await t.query.contactos.findFirst({ where: eq(s.contactos.id, id) });
    if (!antes) throw new ErrorNegocio("El contacto no existe");
    const dup = await buscarPorTelefono(d.telefono, id, t);
    if (dup) throw new ErrorNegocio(`Ese teléfono ya es de ${nombreCompleto(dup)} (#${dup.id})`);
    const [despues] = await t.update(s.contactos).set(d).where(eq(s.contactos.id, id)).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes, despues, descripcion: "Datos editados" });
  });
}

export async function cambiarEtapaManual(usuarioId: number, id: number, etapa: Etapa) {
  await db.transaction(async (t) => {
    const c = await t.query.contactos.findFirst({ where: eq(s.contactos.id, id) });
    if (!c) throw new ErrorNegocio("El contacto no existe");
    if (!etapasManuales(c.etapa).includes(etapa)) throw new ErrorNegocio(`No se puede pasar de ${ETIQUETA_ETAPA[c.etapa]} a ${ETIQUETA_ETAPA[etapa]} a mano`);
    await t.update(s.contactos).set({ etapa }).where(eq(s.contactos.id, id));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO",
      antes: { etapa: c.etapa }, despues: { etapa },
      descripcion: `Etapa: ${ETIQUETA_ETAPA[c.etapa]} → ${ETIQUETA_ETAPA[etapa]}`,
    });
  });
}

// ---------- Actividades ----------

export async function agregarActividad(
  usuarioId: number,
  contactoId: number,
  a: { tipo: TipoActividad; fechaProgramada: Date; realizada: boolean; nota: string | null; proximoContacto?: string | null },
) {
  await db.transaction(async (t) => {
    const c = await t.query.contactos.findFirst({ where: eq(s.contactos.id, contactoId) });
    if (!c) throw new ErrorNegocio("El contacto no existe");
    await t.insert(s.actividades).values({
      contactoId,
      tipo: a.tipo,
      fechaProgramada: a.fechaProgramada,
      realizadaEn: a.realizada ? new Date() : null,
      nota: a.nota,
      usuarioId,
    });
    if (a.proximoContacto !== undefined && a.proximoContacto !== c.proximoContacto) {
      await t.update(s.contactos).set({ proximoContacto: a.proximoContacto }).where(eq(s.contactos.id, contactoId));
    }
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: contactoId, accion: "CREAR",
      descripcion: `${a.realizada ? "Registró" : "Agendó"} ${a.tipo.toLowerCase()}${a.nota ? `: ${a.nota.slice(0, 80)}` : ""}`,
    });
  });
}

/** Marca una actividad como hecha; opcionalmente fija el próximo contacto. */
export async function completarActividad(usuarioId: number, actividadId: number, nota: string | null, proximoContacto: string | null) {
  await db.transaction(async (t) => {
    const a = await t.query.actividades.findFirst({ where: eq(s.actividades.id, actividadId) });
    if (!a) throw new ErrorNegocio("La actividad no existe");
    if (a.realizadaEn) return;
    await t
      .update(s.actividades)
      .set({ realizadaEn: new Date(), nota: nota ? [a.nota, nota].filter(Boolean).join(" — ") : a.nota })
      .where(eq(s.actividades.id, actividadId));
    await t.update(s.contactos).set({ proximoContacto }).where(eq(s.contactos.id, a.contactoId));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: a.contactoId, accion: "MODIFICAR", descripcion: `Completó ${a.tipo.toLowerCase()}${nota ? `: ${nota.slice(0, 80)}` : ""}` });
  });
}

/** Resuelve el "próximo contacto" sin actividad agendada: registra el contacto hecho y reprograma. */
export async function resolverProximo(usuarioId: number, contactoId: number, nota: string | null, proximoContacto: string | null) {
  await agregarActividad(usuarioId, contactoId, { tipo: "LLAMADA", fechaProgramada: new Date(), realizada: true, nota, proximoContacto });
}

// ---------- Pedidos ----------

export interface DatosPedido {
  marca: string | null;
  modelo: string | null;
  anioDesde: number | null;
  anioHasta: number | null;
  presupuestoMax: number | null;
  notas: string | null;
}

export async function crearPedido(usuarioId: number, contactoId: number, p: DatosPedido) {
  if (p.anioDesde && p.anioHasta && p.anioDesde > p.anioHasta) throw new ErrorNegocio("El año desde es mayor que el año hasta");
  await db.transaction(async (t) => {
    const [ped] = await t.insert(s.pedidos).values({ ...p, contactoId }).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: contactoId, accion: "CREAR", despues: ped, descripcion: "Pedido registrado" });
  });
}

export async function cambiarEstadoPedido(usuarioId: number, pedidoId: number, estado: "ABIERTO" | "CUMPLIDO" | "DESCARTADO") {
  await db.transaction(async (t) => {
    const p = await t.query.pedidos.findFirst({ where: eq(s.pedidos.id, pedidoId) });
    if (!p) throw new ErrorNegocio("El pedido no existe");
    await t.update(s.pedidos).set({ estado }).where(eq(s.pedidos.id, pedidoId));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: p.contactoId, accion: "CAMBIO_ESTADO",
      antes: { pedido: p.estado }, despues: { pedido: estado }, descripcion: `Pedido ${estado.toLowerCase()}`,
    });
  });
}

// ---------- Importación ----------

export interface FilaContacto extends DatosContacto {
  fila: number;
  duplicado: string | null;
}

/** Crea los contactos que no estén duplicados (por teléfono). Devuelve cuántos se crearon y cuántos se saltearon. */
export async function importarContactos(usuarioId: number, filas: FilaContacto[]) {
  return db.transaction(async (t) => {
    let creados = 0;
    let salteados = 0;
    const vistos = new Set<string>();
    for (const f of filas) {
      const tel = normalizarTelefono(f.telefono);
      if (!f.nombre.trim() || (tel && vistos.has(tel)) || (await buscarPorTelefono(f.telefono, undefined, t))) {
        salteados++;
        continue;
      }
      if (tel) vistos.add(tel);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se descartan campos solo de la vista previa
      const { fila, duplicado, ...d } = f;
      const [c] = await t.insert(s.contactos).values({ ...d, creadoPor: usuarioId }).returning();
      await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: c.id, accion: "CREAR", descripcion: "Importado desde planilla" });
      creados++;
    }
    return { creados, salteados };
  });
}

