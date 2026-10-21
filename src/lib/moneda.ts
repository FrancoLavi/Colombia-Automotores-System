import "server-only";
import { cookies } from "next/headers";
import { formateadorMoneda } from "./formato";
import { tcHoy } from "@/server/vehiculos";

export const COOKIE_VISTA = "vista_moneda";

/**
 * Vista de importes elegida con el botón "Ver en USD". Devuelve el formateador a usar en pantalla:
 * en dólares convierte con el blue de hoy; los datos guardados no cambian.
 */
export async function vistaMoneda() {
  const enDolares = (await cookies()).get(COOKIE_VISTA)?.value === "USD";
  const tc = enDolares ? await tcHoy() : null;
  return {
    enDolares: enDolares && !!tc,
    tc: tc?.valor ?? null,
    fuente: tc?.fuente ?? null,
    m: formateadorMoneda(enDolares, tc?.valor ?? null),
  };
}
