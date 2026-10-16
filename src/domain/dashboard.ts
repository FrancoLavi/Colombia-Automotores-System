// Indicadores del tablero de inicio. Ver docs/MVP.md (HU-6.2, HU-6.3).
import { r2 } from "./negocio";

/** "2026-10" */
export const periodoDe = (d: Date | string) => (typeof d === "string" ? d.slice(0, 7) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const nombreMes = (periodo: string) => `${MESES[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(2, 4)}`;

/**
 * Objetivo de unidades del mes: el cargado en configuración o, si no hay,
 * la mitad del stock con el que arrancó el mes (la meta que pidieron los socios).
 */
export function objetivoUnidades(guardado: number | null | undefined, stockInicioMes: number): { valor: number; automatico: boolean } {
  if (guardado != null && guardado > 0) return { valor: guardado, automatico: false };
  return { valor: Math.max(1, Math.ceil(stockInicioMes / 2)), automatico: true };
}

/** Últimos 12 meses (incluido el actual), del más viejo al más nuevo, con la cantidad de ventas cerradas. */
export function ventasPorMes(fechasCierre: string[], hoy: Date = new Date()) {
  const meses: { periodo: string; etiqueta: string; ventas: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const p = periodoDe(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1));
    meses.push({ periodo: p, etiqueta: nombreMes(p), ventas: 0 });
  }
  for (const f of fechasCierre) {
    const m = meses.find((x) => x.periodo === periodoDe(f));
    if (m) m.ventas++;
  }
  return meses;
}

/** Días promedio en stock por modelo (de disponible a vendido), los que más rápido rotan primero. */
export function rotacionPorModelo(ventas: { marca: string; modelo: string; dias: number }[]) {
  const grupos = new Map<string, { modelo: string; total: number; n: number }>();
  for (const v of ventas) {
    const k = `${v.marca} ${v.modelo}`;
    const g = grupos.get(k) ?? { modelo: k, total: 0, n: 0 };
    g.total += v.dias;
    g.n++;
    grupos.set(k, g);
  }
  return [...grupos.values()].map((g) => ({ modelo: g.modelo, dias: Math.round(g.total / g.n), ventas: g.n })).sort((a, b) => a.dias - b.dias);
}

/** Rotación del mes: vendidos / stock al inicio del mes (meta: 50 %). */
export const rotacion = (vendidos: number, stockInicio: number) => (stockInicio > 0 ? r2(vendidos / stockInicio) : 0);

/** Avance (0 a 1) hacia una meta. */
export const avance = (actual: number, meta: number) => (meta > 0 ? Math.max(0, Math.min(1, actual / meta)) : 0);
