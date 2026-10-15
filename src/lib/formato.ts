const pesosFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("es-AR");

export const pesos = (n: number | null | undefined) => (n == null ? "—" : pesosFmt.format(n));
export const usd = (n: number | null | undefined) => (n == null ? "—" : `USD ${usdFmt.format(n)}`);
export const numero = (n: number | null | undefined) => (n == null ? "—" : numFmt.format(n));
export const porcentaje = (n: number) => `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;

/** "2026-10-14" → "14/10/2026" */
export function fecha(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso) : iso;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Fecha de hoy en formato ISO local (AAAA-MM-DD). */
export function hoyIso(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
