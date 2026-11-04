import "server-only";
import { ErrorNegocio } from "@/server/errores";
import { ErrorValidacion, type Resultado } from "./form";

/** Ejecuta una acción y convierte los errores esperables en un mensaje para el formulario. */
export async function ejecutar(fn: () => Promise<string | void | { mensaje: string; id: number }>): Promise<Resultado> {
  try {
    const r = await fn();
    if (r && typeof r === "object") return { ok: true, mensaje: r.mensaje, id: r.id };
    return { ok: true, mensaje: r ?? undefined };
  } catch (e) {
    if (e instanceof ErrorNegocio || e instanceof ErrorValidacion) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo." };
  }
}
