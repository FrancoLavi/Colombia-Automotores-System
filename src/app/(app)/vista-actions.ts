"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { COOKIE_VISTA } from "@/lib/moneda";
import { actualizarDesdeInternet } from "@/server/dolar";
import type { Resultado } from "@/lib/form";

export async function cambiarVista(enDolares: boolean) {
  await requerirUsuario();
  (await cookies()).set(COOKIE_VISTA, enDolares ? "USD" : "ARS", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function actualizarDolarAccion(): Promise<Resultado> {
  const u = await requerirUsuario();
  const valor = await actualizarDesdeInternet(u.id);
  revalidatePath("/", "layout");
  return valor ? { ok: true, mensaje: `Blue actualizado: $ ${valor.toLocaleString("es-AR")}` } : { ok: false, error: "No se pudo consultar el dólar online. Cargalo a mano." };
}
