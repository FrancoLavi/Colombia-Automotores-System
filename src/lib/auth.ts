import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ahoraS } from "@/domain/seguridad";
import { COOKIE_SESION, firmarSesion, opcionesCookie, verificarSesion } from "./sesion";

export async function usuarioActual() {
  const s = await verificarSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!s) return null;
  const u = await db.query.usuarios.findFirst({ where: eq(schema.usuarios.id, s.uid) });
  // T4: si cambió la contraseña o se cerraron todas las sesiones, esta ya no vale.
  return u && u.activo && u.versionSesion === s.v ? u : null;
}

/** Abre (o reabre con la versión nueva) la sesión del usuario en este navegador. */
export async function guardarSesion(u: { id: number; rol: "ADMIN" | "INVERSOR"; versionSesion: number }, ini: number = ahoraS()) {
  (await cookies()).set(COOKIE_SESION, await firmarSesion({ uid: u.id, rol: u.rol, v: u.versionSesion, ini }), opcionesCookie());
}

/**
 * Exige sesión válida. Por defecto exige además rol ADMIN (T2): un usuario INVERSOR
 * solo entra a su pantalla de consulta (/mi-inversion) y no puede ejecutar acciones.
 */
export async function requerirUsuario(opts: { permitirInversor?: boolean } = {}) {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  if (u.rol === "INVERSOR" && !opts.permitirInversor) redirect("/mi-inversion");
  return u;
}
