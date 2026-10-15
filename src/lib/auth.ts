import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { COOKIE_SESION, verificarSesion } from "./sesion";

export async function usuarioActual() {
  const s = await verificarSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!s) return null;
  const u = await db.query.usuarios.findFirst({ where: eq(schema.usuarios.id, s.uid) });
  return u && u.activo ? u : null;
}

/** Exige sesión válida (y opcionalmente rol ADMIN). Usar en páginas y server actions. */
export async function requerirUsuario(opts: { admin?: boolean } = {}) {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  if (opts.admin && u.rol !== "ADMIN") redirect("/");
  return u;
}
