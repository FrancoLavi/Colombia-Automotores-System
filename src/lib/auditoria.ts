import "server-only";
import { db, schema, type Tx } from "@/db";

type Accion = "CREAR" | "MODIFICAR" | "ELIMINAR" | "CAMBIO_ESTADO";

/** Campos distintos entre dos versiones de un registro: { campo: [antes, después] }. */
export function diferencias(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) {
  const cambios: Record<string, [unknown, unknown]> = {};
  const claves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  for (const k of claves) {
    if (k === "creadoEn") continue;
    const a = antes?.[k] ?? null;
    const d = despues?.[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(d)) cambios[k] = [a, d];
  }
  return cambios;
}

/** T1: registra un cambio. Llamar dentro de la misma transacción que la modificación. */
export async function auditar(
  tx: Tx | typeof db,
  p: {
    usuarioId: number;
    entidad: string;
    entidadId: number;
    accion: Accion;
    antes?: Record<string, unknown> | null;
    despues?: Record<string, unknown> | null;
    descripcion?: string;
  },
) {
  const cambios = diferencias(p.antes ?? null, p.despues ?? null);
  // Se omite solo una edición que compara versiones y no cambió nada; un evento descripto siempre se registra.
  if (p.accion === "MODIFICAR" && (p.antes || p.despues) && Object.keys(cambios).length === 0) return;
  await tx.insert(schema.auditoria).values({
    usuarioId: p.usuarioId,
    entidad: p.entidad,
    entidadId: p.entidadId,
    accion: p.accion,
    cambios,
    descripcion: p.descripcion,
  });
}
