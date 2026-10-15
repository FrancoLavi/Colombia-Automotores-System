"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { COOKIE_SESION, DURACION_SESION_S, firmarSesion } from "@/lib/sesion";

export async function ingresar(_prev: { error: string }, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const u = await db.query.usuarios.findFirst({ where: eq(schema.usuarios.email, email) });
  if (!u || !u.activo || !(await bcrypt.compare(password, u.passwordHash))) {
    return { error: "Mail o contraseña incorrectos." };
  }
  (await cookies()).set(COOKIE_SESION, await firmarSesion({ uid: u.id, rol: u.rol }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DURACION_SESION_S,
    path: "/",
  });
  redirect("/");
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/login");
}
