import { interpretarImporte } from "@/domain/importar";

export type Resultado = { ok: boolean; error?: string; mensaje?: string };
export const INICIAL: Resultado = { ok: false };

export class ErrorValidacion extends Error {}

export function texto(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
}

export function requerido(fd: FormData, k: string, etiqueta: string): string {
  const v = texto(fd, k);
  if (!v) throw new ErrorValidacion(`Completá: ${etiqueta}`);
  return v;
}

/** Lee un número escrito como "16.500.000", "1.234,50", "1.500" (mil quinientos) o "7.5". */
export function leerNumero(v: string): number | null {
  // Un solo punto que no separa miles ("7.5", "1460.25") es decimal; si no, formato argentino.
  const decimalConPunto = /^-?\d+\.\d+$/.test(v) && !/^-?\d{1,3}(\.\d{3})+$/.test(v);
  return decimalConPunto ? Number(v) : interpretarImporte(v);
}

export function importe(fd: FormData, k: string): number | null {
  const v = texto(fd, k);
  if (!v) return null;
  const n = leerNumero(v);
  if (n == null || !Number.isFinite(n)) throw new ErrorValidacion(`Importe inválido: ${v}`);
  return n;
}

export function importeRequerido(fd: FormData, k: string, etiqueta: string): number {
  const n = importe(fd, k);
  if (n == null) throw new ErrorValidacion(`Completá: ${etiqueta}`);
  return n;
}

export function entero(fd: FormData, k: string): number | null {
  const n = importe(fd, k);
  return n == null ? null : Math.round(n);
}

export function fechaIso(fd: FormData, k: string): string | null {
  const v = texto(fd, k);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ErrorValidacion(`Fecha inválida: ${v}`);
  return v;
}

export function opcion<T extends string>(fd: FormData, k: string, validas: readonly T[], defecto?: T): T {
  const v = texto(fd, k) ?? defecto;
  if (!v || !validas.includes(v as T)) throw new ErrorValidacion(`Valor inválido para ${k}`);
  return v as T;
}
