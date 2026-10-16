import "server-only";
import bcrypt from "bcryptjs";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { auditar } from "@/lib/auditoria";
import { ErrorNegocio } from "./errores";

const ENTIDAD = "configuracion";

export async function datosConfiguracion() {
  const [participes, usuarios, objetivos, documentos, categorias, autosPorParticipe] = await Promise.all([
    db.select().from(s.participes).orderBy(asc(s.participes.id)),
    db
      .select({ id: s.usuarios.id, nombre: s.usuarios.nombre, email: s.usuarios.email, rol: s.usuarios.rol, activo: s.usuarios.activo, participeId: s.usuarios.participeId })
      .from(s.usuarios)
      .orderBy(asc(s.usuarios.id)),
    db.select().from(s.objetivos).orderBy(desc(s.objetivos.periodo)).limit(12),
    db.select().from(s.tiposDocumento).orderBy(asc(s.tiposDocumento.orden)),
    db.select().from(s.categoriasGasto).orderBy(asc(s.categoriasGasto.orden)),
    db
      .select({ participeId: s.vehiculos.participeId, n: sql<number>`count(*)::int` })
      .from(s.vehiculos)
      .where(sql`${s.vehiculos.estado} in ('POR_INGRESAR','DISPONIBLE','RESERVADO')`)
      .groupBy(s.vehiculos.participeId),
  ]);
  return {
    participes: participes.map((p) => ({ ...p, autos: autosPorParticipe.find((a) => a.participeId === p.id)?.n ?? 0 })),
    usuarios,
    objetivos,
    documentos,
    categorias,
  };
}

// ---------- Inversores ----------

export async function crearInversor(usuarioId: number, nombre: string) {
  if (!nombre.trim()) throw new ErrorNegocio("Completá el nombre");
  await db.transaction(async (t) => {
    const [p] = await t.insert(s.participes).values({ nombre: nombre.trim(), tipo: "INVERSOR" }).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: p.id, accion: "CREAR", descripcion: `Inversor agregado: ${p.nombre}` });
  });
}

export async function editarParticipe(usuarioId: number, id: number, nombre: string, activo: boolean) {
  if (!nombre.trim()) throw new ErrorNegocio("Completá el nombre");
  await db.transaction(async (t) => {
    const p = await t.query.participes.findFirst({ where: eq(s.participes.id, id) });
    if (!p) throw new ErrorNegocio("No existe");
    if (p.tipo === "SALON" && !activo) throw new ErrorNegocio("El salón no se puede desactivar");
    await t.update(s.participes).set({ nombre: nombre.trim(), activo }).where(eq(s.participes.id, id));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes: { nombre: p.nombre, activo: p.activo }, despues: { nombre, activo }, descripcion: `Inversor ${p.nombre}` });
  });
}

// ---------- Usuarios ----------

export async function crearUsuario(
  usuarioId: number,
  d: { nombre: string; email: string; password: string; rol: "ADMIN" | "INVERSOR"; participeId: number | null },
) {
  const email = d.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErrorNegocio("Mail inválido");
  if (d.password.length < 8) throw new ErrorNegocio("La contraseña tiene que tener al menos 8 caracteres");
  if (d.rol === "INVERSOR" && !d.participeId) throw new ErrorNegocio("Elegí qué inversor es");
  await db.transaction(async (t) => {
    if (await t.query.usuarios.findFirst({ where: eq(s.usuarios.email, email) })) throw new ErrorNegocio("Ya existe un usuario con ese mail");
    const [u] = await t
      .insert(s.usuarios)
      .values({ nombre: d.nombre.trim(), email, passwordHash: await bcrypt.hash(d.password, 10), rol: d.rol, participeId: d.rol === "INVERSOR" ? d.participeId : null })
      .returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: u.id, accion: "CREAR", descripcion: `Usuario creado: ${u.nombre} (${u.rol === "ADMIN" ? "acceso total" : "inversor, solo consulta"})` });
  });
}

export async function cambiarActivoUsuario(usuarioId: number, id: number, activo: boolean) {
  if (id === usuarioId && !activo) throw new ErrorNegocio("No podés desactivar tu propio usuario");
  await db.transaction(async (t) => {
    const u = await t.query.usuarios.findFirst({ where: eq(s.usuarios.id, id) });
    if (!u) throw new ErrorNegocio("No existe");
    if (!activo && u.rol === "ADMIN") {
      const [{ n }] = await t.select({ n: sql<number>`count(*)::int` }).from(s.usuarios).where(sql`${s.usuarios.rol} = 'ADMIN' and ${s.usuarios.activo}`);
      if (n <= 1) throw new ErrorNegocio("Tiene que quedar al menos un administrador activo");
    }
    await t.update(s.usuarios).set({ activo }).where(eq(s.usuarios.id, id));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes: { activo: u.activo }, despues: { activo }, descripcion: `Usuario ${u.nombre} ${activo ? "activado" : "desactivado"}` });
  });
}

export async function cambiarPassword(usuarioId: number, id: number, nueva: string, actual?: string) {
  if (nueva.length < 8) throw new ErrorNegocio("La contraseña tiene que tener al menos 8 caracteres");
  const u = await db.query.usuarios.findFirst({ where: eq(s.usuarios.id, id) });
  if (!u) throw new ErrorNegocio("No existe");
  if (actual !== undefined && !(await bcrypt.compare(actual, u.passwordHash))) throw new ErrorNegocio("La contraseña actual no es correcta");
  await db.transaction(async (t) => {
    await t.update(s.usuarios).set({ passwordHash: await bcrypt.hash(nueva, 10) }).where(eq(s.usuarios.id, id));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", descripcion: `Contraseña cambiada (${u.nombre})` });
  });
}

// ---------- Objetivos ----------

export async function guardarObjetivo(usuarioId: number, periodo: string, unidades: number, ganancia: number) {
  if (!/^\d{4}-\d{2}$/.test(periodo)) throw new ErrorNegocio("Mes inválido");
  if (unidades < 0 || ganancia < 0) throw new ErrorNegocio("Los objetivos no pueden ser negativos");
  await db.transaction(async (t) => {
    await t.insert(s.objetivos).values({ periodo, unidades, ganancia }).onConflictDoUpdate({ target: s.objetivos.periodo, set: { unidades, ganancia } });
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: 0, accion: "MODIFICAR", descripcion: `Objetivo ${periodo}: ${unidades} autos · $ ${ganancia.toLocaleString("es-AR")}` });
  });
}

// ---------- Papeles y categorías ----------

export async function crearTipoDocumento(usuarioId: number, nombre: string, obligatorio: boolean, tieneVencimiento: boolean) {
  if (!nombre.trim()) throw new ErrorNegocio("Completá el nombre");
  await db.transaction(async (t) => {
    const [{ max }] = await t.select({ max: sql<number>`coalesce(max(${s.tiposDocumento.orden}), 0)::int` }).from(s.tiposDocumento);
    const [d] = await t.insert(s.tiposDocumento).values({ nombre: nombre.trim(), obligatorio, tieneVencimiento, orden: max + 1 }).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: d.id, accion: "CREAR", descripcion: `Papel agregado: ${d.nombre}${obligatorio ? " (obligatorio)" : ""}` });
  });
}

export async function editarTipoDocumento(usuarioId: number, id: number, d: { obligatorio: boolean; tieneVencimiento: boolean; activo: boolean }) {
  await db.transaction(async (t) => {
    const antes = await t.query.tiposDocumento.findFirst({ where: eq(s.tiposDocumento.id, id) });
    if (!antes) throw new ErrorNegocio("No existe");
    await t.update(s.tiposDocumento).set(d).where(eq(s.tiposDocumento.id, id));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes, despues: { ...antes, ...d }, descripcion: `Papel ${antes.nombre}` });
  });
}

export async function crearCategoria(usuarioId: number, nombre: string) {
  if (!nombre.trim()) throw new ErrorNegocio("Completá el nombre");
  await db.transaction(async (t) => {
    const [{ max }] = await t.select({ max: sql<number>`coalesce(max(${s.categoriasGasto.orden}), 0)::int` }).from(s.categoriasGasto);
    const [c] = await t.insert(s.categoriasGasto).values({ nombre: nombre.trim(), orden: max + 1 }).returning();
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: c.id, accion: "CREAR", descripcion: `Categoría de gasto agregada: ${c.nombre}` });
  });
}

export async function cambiarActivoCategoria(usuarioId: number, id: number, activo: boolean) {
  await db.transaction(async (t) => {
    const c = await t.query.categoriasGasto.findFirst({ where: eq(s.categoriasGasto.id, id) });
    if (!c) throw new ErrorNegocio("No existe");
    await t.update(s.categoriasGasto).set({ activo }).where(eq(s.categoriasGasto.id, id));
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "MODIFICAR", antes: { activo: c.activo }, despues: { activo }, descripcion: `Categoría ${c.nombre} ${activo ? "activada" : "desactivada"}` });
  });
}

// ---------- Historial global ----------

export async function historialGlobal(f: { usuarioId?: number; entidad?: string; desde?: string; hasta?: string; q?: string }) {
  const cond = [];
  if (f.usuarioId) cond.push(eq(s.auditoria.usuarioId, f.usuarioId));
  if (f.entidad) cond.push(eq(s.auditoria.entidad, f.entidad));
  if (f.desde) cond.push(sql`${s.auditoria.fecha} >= ${new Date(`${f.desde}T00:00:00`)}`);
  if (f.hasta) cond.push(sql`${s.auditoria.fecha} <= ${new Date(`${f.hasta}T23:59:59`)}`);
  if (f.q?.trim()) cond.push(sql`${s.auditoria.descripcion} ilike ${"%" + f.q.trim() + "%"}`);
  return db
    .select({ a: s.auditoria, usuario: s.usuarios.nombre })
    .from(s.auditoria)
    .leftJoin(s.usuarios, eq(s.usuarios.id, s.auditoria.usuarioId))
    .where(cond.length ? sql.join(cond, sql` and `) : undefined)
    .orderBy(desc(s.auditoria.fecha), desc(s.auditoria.id))
    .limit(300);
}
