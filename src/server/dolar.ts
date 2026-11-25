import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { hoyIso } from "@/lib/formato";

// Dólar blue online (venta). Fuente pública y gratuita: https://dolarapi.com
const URL_BLUE = "https://dolarapi.com/v1/dolares/blue";

export async function blueOnline(): Promise<{ valor: number; actualizado: string } | null> {
  if (process.env.DOLAR_API === "off") return null;
  try {
    const r = await fetch(URL_BLUE, { signal: AbortSignal.timeout(4_000), cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as { venta?: number; fechaActualizacion?: string };
    return typeof d.venta === "number" && d.venta > 0 ? { valor: d.venta, actualizado: d.fechaActualizacion ?? "" } : null;
  } catch {
    return null;
  }
}

// Histórico del blue (venta) por día, también fines de semana. Fuente pública y gratuita: https://argentinadatos.com
const URL_HISTORICO = "https://api.argentinadatos.com/v1/cotizaciones/dolares/blue";

/**
 * V7: el blue de un día pasado, para fijar el dólar de un auto que se carga después de comprado.
 * Primero mira si hay uno guardado de ese día; si no, lo trae de internet. Sin conexión, null.
 */
export async function blueDeFecha(fecha: string): Promise<number | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const guardado = await db.query.tiposCambio.findFirst({ where: eq(s.tiposCambio.fecha, fecha) });
  if (guardado) return guardado.valor;
  if (process.env.DOLAR_API === "off") return null;
  try {
    const r = await fetch(`${URL_HISTORICO}/${fecha.replaceAll("-", "/")}`, { signal: AbortSignal.timeout(4_000), next: { revalidate: 86_400 } });
    if (!r.ok) return null;
    const d = (await r.json()) as { venta?: number };
    return typeof d.venta === "number" && d.venta > 0 ? d.venta : null;
  } catch {
    return null;
  }
}

/** Último dólar guardado. */
export async function ultimoDolar() {
  const [u] = await db.select().from(s.tiposCambio).orderBy(desc(s.tiposCambio.fecha)).limit(1);
  return u ?? null;
}

/**
 * Dólar de hoy: si todavía no hay uno cargado para hoy, lo trae de internet y lo guarda.
 * Un valor cargado a mano en el día nunca se pisa. Sin conexión, devuelve el último conocido.
 */
export async function dolarDeHoy() {
  const hoy = hoyIso();
  const ultimo = await ultimoDolar();
  if (ultimo?.fecha === hoy) return ultimo;
  const online = await blueOnline();
  if (!online) return ultimo;
  await db.insert(s.tiposCambio).values({ fecha: hoy, valor: online.valor, fuente: "API" }).onConflictDoNothing();
  return (await db.query.tiposCambio.findFirst({ where: eq(s.tiposCambio.fecha, hoy) })) ?? ultimo;
}

/** Fuerza la actualización desde internet (botón "Actualizar"). No pisa un valor manual del día salvo que se pida. */
export async function actualizarDesdeInternet(usuarioId: number) {
  const online = await blueOnline();
  if (!online) return null;
  const hoy = hoyIso();
  await db
    .insert(s.tiposCambio)
    .values({ fecha: hoy, valor: online.valor, fuente: "API", usuarioId })
    .onConflictDoUpdate({ target: s.tiposCambio.fecha, set: { valor: online.valor, fuente: "API", usuarioId } });
  return online.valor;
}
