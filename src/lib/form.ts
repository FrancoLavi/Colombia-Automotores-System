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

/** Acepta "16.500.000", "1.234,50" o "1234.5". */
export function importe(fd: FormData, k: string): number | null {
  const v = texto(fd, k);
  if (!v) return null;
  const n = /^\d+(\.\d+)?$/.test(v) ? Number(v) : interpretarImporte(v);
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
