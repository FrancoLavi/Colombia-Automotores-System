import "server-only";
import { cookies } from "next/headers";

export const COOKIE_TEMA = "tema";
export type Tema = "claro" | "oscuro";

/**
 * Tema de pantalla. Es una preferencia personal de quien mira, no un dato del salón:
 * por eso va en cookie y no en la base, y no se audita.
 */
export async function temaActual(): Promise<Tema> {
  return (await cookies()).get(COOKIE_TEMA)?.value === "oscuro" ? "oscuro" : "claro";
}
