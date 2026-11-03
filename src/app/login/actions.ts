"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION } from "@/lib/sesion";
import { guardarSesion } from "@/lib/auth";
import { rutaDeVuelta } from "@/domain/seguridad";
import { ErrorNegocio } from "@/server/errores";
import { pedirRecuperacion, restablecerPassword, verificarCredenciales } from "@/server/seguridad";

type Estado = { error: string; ok?: boolean };

export async function ingresar(_prev: Estado, form: FormData): Promise<Estado> {
  let u;
  try {
    u = await verificarCredenciales(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    console.error(e);
    return { error: "No se pudo ingresar. Probá de nuevo en un momento." };
  }
  await guardarSesion(u);
  redirect(u.rol === "INVERSOR" ? "/mi-inversion" : (rutaDeVuelta(String(form.get("volver") ?? "")) ?? "/"));
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/login");
}

/** T4: siempre responde lo mismo, exista o no el mail, para no revelar quién tiene usuario. */
export async function recuperar(_prev: Estado, form: FormData): Promise<Estado> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribí un mail válido." };
  try {
    await pedirRecuperacion(email);
  } catch (e) {
    // Si falla el envío lo registramos, pero la respuesta no cambia (no revela si el mail existe).
    console.error(e);
  }
  return { error: "", ok: true };
}

export async function restablecer(token: string, _prev: Estado, form: FormData): Promise<Estado> {
  let u;
  try {
    u = await restablecerPassword(token, String(form.get("nueva") ?? ""), String(form.get("repetir") ?? ""));
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    console.error(e);
    return { error: "No se pudo cambiar la contraseña. Probá de nuevo." };
  }
  await guardarSesion(u);
  redirect(u.rol === "INVERSOR" ? "/mi-inversion" : "/");
}
