const pesosFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("es-AR");

const pesosCentavosFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** $ 1.234.567; con centavos solo si los tiene ($ 9.449.999,50), así no se redondea plata que existe. */
export const pesos = (n: number | null | undefined) =>
  n == null ? "—" : Math.round(n * 100) % 100 === 0 ? pesosFmt.format(n) : pesosCentavosFmt.format(n);
export const usd = (n: number | null | undefined) => (n == null ? "—" : `USD ${usdFmt.format(n)}`);
export const numero = (n: number | null | undefined) => (n == null ? "—" : numFmt.format(n));
export const porcentaje = (n: number) => `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;

/**
 * Formateador de importes según la vista elegida: en pesos o convertidos a dólares
 * con el blue de hoy. Solo cambia cómo se muestra; los valores guardados siguen en pesos
 * y el dólar fijado en cada compra no se modifica.
 */
export function formateadorMoneda(enDolares: boolean, tc: number | null) {
  if (!enDolares || !tc) return pesos;
  return (n: number | null | undefined) => (n == null ? "—" : `${n < 0 ? "−" : ""}USD ${usdFmt.format(Math.abs(n) / tc)}`);
}

/**
 * Nombre del contacto para mostrar en pantalla: siempre en mayúsculas, como en los
 * formularios del registro. Se guarda tal cual lo escribieron; esto es solo presentación.
 */
export const nombreContacto = (c: { nombre: string; apellido?: string | null }) => `${c.nombre} ${c.apellido ?? ""}`.trim().toUpperCase();

/**
 * Todo se muestra y se calcula en hora de Argentina. El servidor de producción corre en UTC:
 * sin fijar la zona, las horas salen tres horas adelantadas y, pasadas las nueve de la noche,
 * además con el día cambiado. En desarrollo no se nota porque la máquina ya está en -03.
 */
export const ZONA = "America/Argentina/Buenos_Aires";

/** "2026-10-14" → "14/10/2026" */
export function fecha(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  // Un "2026-10-14" ya es un día, sin hora: se muestra tal cual. Pasarlo por una zona lo correría.
  if (typeof iso === "string" && iso.length === 10) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  }
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA });
}

/** "29/10/26, 2:44 p. m." — fecha y hora en Argentina, para historiales y agendas. */
export function fechaHora(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "numeric", minute: "2-digit", timeZone: ZONA });
}

/** "2:44 p. m." — solo la hora, en Argentina. */
export function hora(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleTimeString("es-AR", { hour: "numeric", minute: "2-digit", timeZone: ZONA });
}

/** Fecha de hoy en Argentina, en formato ISO (AAAA-MM-DD). */
export function hoyIso(d = new Date()) {
  // en-CA da justo "AAAA-MM-DD".
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
