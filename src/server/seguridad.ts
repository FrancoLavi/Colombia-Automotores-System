import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { auditar } from "@/lib/auditoria";
import { enviarMail, urlApp, type Mail } from "@/lib/mail";
import {
  MAX_PEDIDOS_RECUPERACION_HORA,
  minutosBloqueado,
  problemaPassword,
  registrarFallo,
  VENCE_RECUPERACION_MIN,
} from "@/domain/seguridad";
import { ErrorNegocio } from "./errores";

// T4 · Seguridad de acceso: ingreso con bloqueo por intentos, recuperación de contraseña por mail
// y cierre de sesiones en todos los dispositivos.

// Igual que el resto de la gestión de usuarios (src/server/configuracion.ts).
const ENTIDAD = "configuracion";
type Usuario = typeof s.usuarios.$inferSelect;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Valida mail y contraseña. Tras 5 fallos seguidos bloquea 15 minutos (T4). */
export async function verificarCredenciales(emailCrudo: string, password: string, ahora: Date = new Date()): Promise<Usuario> {
  const email = emailCrudo.trim().toLowerCase();
  const u = await db.query.usuarios.findFirst({ where: eq(s.usuarios.email, email) });
  // Mismo mensaje exista o no el mail, para no revelar quién tiene usuario.
  const incorrecto = new ErrorNegocio("Mail o contraseña incorrectos.");
  if (!u || !u.activo) throw incorrecto;
  const espera = minutosBloqueado(u.bloqueadoHasta, ahora);
  if (espera > 0) {
    throw new ErrorNegocio(
      `Por seguridad, después de varios intentos fallidos el ingreso queda bloqueado un rato. Probá de nuevo en ${espera} ${espera === 1 ? "minuto" : "minutos"} o recuperá tu contraseña.`,
    );
  }
  if (!(await bcrypt.compare(password, u.passwordHash))) {
    const f = registrarFallo(u.intentosFallidos, ahora);
    await db.update(s.usuarios).set({ intentosFallidos: f.intentos, bloqueadoHasta: f.bloqueadoHasta }).where(eq(s.usuarios.id, u.id));
    if (f.bloqueadoHasta) {
      await db.transaction((t) =>
        auditar(t, { usuarioId: u.id, entidad: ENTIDAD, entidadId: u.id, accion: "MODIFICAR", descripcion: `Ingreso bloqueado 15 minutos por intentos fallidos (${u.nombre})` }),
      );
    }
    throw incorrecto;
  }
  if (u.intentosFallidos || u.bloqueadoHasta) await db.update(s.usuarios).set({ intentosFallidos: 0, bloqueadoHasta: null }).where(eq(s.usuarios.id, u.id));
  return u;
}

function mailRecuperacion(u: Usuario, link: string): Mail {
  const texto = [
    `Hola ${u.nombre}:`,
    "",
    "Pediste cambiar tu contraseña de Colombia Automotores. Entrá a este link para elegir una nueva:",
    link,
    "",
    `El link sirve una sola vez y vence en ${VENCE_RECUPERACION_MIN} minutos.`,
    "Si no lo pediste vos, ignorá este mail: tu contraseña sigue siendo la misma.",
  ].join("\n");
  const html = `<p>Hola ${u.nombre.replace(/[<>&]/g, "")}:</p>
<p>Pediste cambiar tu contraseña de <b>Colombia Automotores</b>. Tocá el botón para elegir una nueva:</p>
<p><a href="${link}" style="display:inline-block;background:#1f4fd1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Elegir contraseña nueva</a></p>
<p style="color:#5b6169;font-size:13px">El link sirve una sola vez y vence en ${VENCE_RECUPERACION_MIN} minutos. Si no lo pediste vos, ignorá este mail: tu contraseña sigue siendo la misma.</p>`;
  return { para: u.email, asunto: "Recuperar tu contraseña · Colombia Automotores", texto, html };
}

/**
 * Pide un link de recuperación. No dice si el mail existe (la pantalla responde siempre lo mismo).
 * Máximo 3 pedidos por hora por usuario, para que no se pueda usar para llenarle la casilla a nadie.
 */
export async function pedirRecuperacion(emailCrudo: string, enviar: (m: Mail) => Promise<void> = enviarMail, ahora: Date = new Date()): Promise<void> {
  const email = emailCrudo.trim().toLowerCase();
  const u = await db.query.usuarios.findFirst({ where: eq(s.usuarios.email, email) });
  if (!u || !u.activo) return;
  const haceUnaHora = new Date(ahora.getTime() - 60 * 60_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.recuperaciones)
    .where(and(eq(s.recuperaciones.usuarioId, u.id), gt(s.recuperaciones.creadoEn, haceUnaHora)));
  if (n >= MAX_PEDIDOS_RECUPERACION_HORA) return;

  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (t) => {
    await t.insert(s.recuperaciones).values({ usuarioId: u.id, tokenHash: hash(token), vence: new Date(ahora.getTime() + VENCE_RECUPERACION_MIN * 60_000), creadoEn: ahora });
    await auditar(t, { usuarioId: u.id, entidad: ENTIDAD, entidadId: u.id, accion: "CREAR", descripcion: `Pedido de recuperación de contraseña (${u.nombre})` });
  });
  await enviar(mailRecuperacion(u, `${urlApp()}/login/restablecer?token=${token}`));
}

async function recuperacionVigente(token: string, ahora: Date) {
  if (!token) return null;
  const r = await db.query.recuperaciones.findFirst({
    where: and(eq(s.recuperaciones.tokenHash, hash(token)), isNull(s.recuperaciones.usadoEn), gt(s.recuperaciones.vence, ahora)),
  });
  if (!r) return null;
  const u = await db.query.usuarios.findFirst({ where: eq(s.usuarios.id, r.usuarioId) });
  return u?.activo ? { r, u } : null;
}

/** Para la pantalla de restablecer: si el link sigue sirviendo, a nombre de quién es. */
export async function linkDeRecuperacion(token: string, ahora: Date = new Date()): Promise<{ nombre: string } | null> {
  const v = await recuperacionVigente(token, ahora);
  return v ? { nombre: v.u.nombre } : null;
}

/**
 * Cambia la contraseña con un link de recuperación. El link queda usado (y los demás pendientes también),
 * se cierran todas las sesiones abiertas y se levanta el bloqueo por intentos.
 */
export async function restablecerPassword(token: string, nueva: string, repetida: string, ahora: Date = new Date()): Promise<Usuario> {
  const problema = problemaPassword(nueva, repetida);
  if (problema) throw new ErrorNegocio(problema);
  const v = await recuperacionVigente(token, ahora);
  if (!v) throw new ErrorNegocio("El link venció o ya se usó. Pedí uno nuevo.");
  const passwordHash = await bcrypt.hash(nueva, 10);
  return db.transaction(async (t) => {
    await t.update(s.recuperaciones).set({ usadoEn: ahora }).where(and(eq(s.recuperaciones.usuarioId, v.u.id), isNull(s.recuperaciones.usadoEn)));
    const [u] = await t
      .update(s.usuarios)
      .set({ passwordHash, versionSesion: v.u.versionSesion + 1, intentosFallidos: 0, bloqueadoHasta: null })
      .where(eq(s.usuarios.id, v.u.id))
      .returning();
    await auditar(t, { usuarioId: u.id, entidad: ENTIDAD, entidadId: u.id, accion: "MODIFICAR", descripcion: `Contraseña cambiada con link de recuperación (${u.nombre}); se cerraron sus sesiones` });
    return u;
  });
}

/** "Cerrar sesión en todos los dispositivos": invalida todas las sesiones del usuario, incluida la actual. */
export async function cerrarTodasLasSesiones(usuarioId: number): Promise<void> {
  await db.transaction(async (t) => {
    const [u] = await t
      .update(s.usuarios)
      .set({ versionSesion: sql`${s.usuarios.versionSesion} + 1` })
      .where(eq(s.usuarios.id, usuarioId))
      .returning();
    if (!u) throw new ErrorNegocio("No existe");
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: usuarioId, accion: "MODIFICAR", descripcion: `Cerró sesión en todos los dispositivos (${u.nombre})` });
  });
}
