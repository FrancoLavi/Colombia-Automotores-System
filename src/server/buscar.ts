import "server-only";
import { desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db, schema as s } from "@/db";
import { normalizarTelefono } from "@/domain/contactos";
import { ETIQUETA_ESTADO } from "@/domain/stock";
import { ETIQUETA_OPERACION, numeroOperacion } from "@/domain/ventas";

export interface ResultadoBusqueda {
  tipo: "auto" | "contacto" | "venta";
  titulo: string;
  detalle: string;
  href: string;
}

// Comparación sin tildes ni mayúsculas: "lucia" encuentra a "Lucía". translate() existe en cualquier Postgres (y en PGlite).
const CON_TILDE = "áéíóúüñÁÉÍÓÚÜÑ";
const SIN_TILDE = "aeiouunAEIOUUN";
const plano = (x: AnyPgColumn | SQL) => sql`translate(${x}, ${CON_TILDE}, ${SIN_TILDE})`;
const quitarTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Búsqueda global (Ctrl+K): autos por patente, marca o modelo; contactos por nombre o teléfono; ventas por número o cliente. */
export async function buscarGlobal(q: string): Promise<ResultadoBusqueda[]> {
  const texto = q.trim();
  if (texto.length < 2) return [];
  const like = `%${quitarTildes(texto).replace(/[%_]/g, "")}%`;
  const soloPatente = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const patente = soloPatente.length >= 2 ? `%${soloPatente}%` : like;
  const tel = normalizarTelefono(texto);
  const numero = /^v?-?0*(\d+)$/i.exec(texto)?.[1];

  const [autos, contactos, ventas] = await Promise.all([
    db
      .select()
      .from(s.vehiculos)
      .where(
        or(
          ilike(s.vehiculos.dominio, patente),
          ilike(plano(sql`${s.vehiculos.marca} || ' ' || ${s.vehiculos.modelo}`), like),
        ),
      )
      .orderBy(desc(s.vehiculos.id))
      .limit(6),
    db
      .select()
      .from(s.contactos)
      .where(
        or(
          ilike(plano(sql`${s.contactos.nombre} || ' ' || coalesce(${s.contactos.apellido}, '')`), like),
          ilike(plano(sql`coalesce(${s.contactos.apellido}, '') || ' ' || ${s.contactos.nombre}`), like),
          tel && tel.length >= 4 ? ilike(s.contactos.telefono, `%${tel}%`) : undefined,
        ),
      )
      .orderBy(desc(s.contactos.id))
      .limit(6),
    db
      .select({ op: s.operaciones, nombre: s.contactos.nombre, apellido: s.contactos.apellido, marca: s.vehiculos.marca, modelo: s.vehiculos.modelo })
      .from(s.operaciones)
      .innerJoin(s.contactos, eq(s.contactos.id, s.operaciones.contactoId))
      .innerJoin(s.vehiculos, eq(s.vehiculos.id, s.operaciones.vehiculoId))
      .where(
        or(
          numero ? eq(s.operaciones.id, Number(numero)) : undefined,
          ilike(plano(sql`${s.contactos.nombre} || ' ' || coalesce(${s.contactos.apellido}, '')`), like),
          ilike(s.vehiculos.dominio, patente),
          ilike(plano(sql`${s.vehiculos.marca} || ' ' || ${s.vehiculos.modelo}`), like),
        ),
      )
      .orderBy(desc(s.operaciones.id))
      .limit(5),
  ]);

  return [
    ...autos.map((v) => ({
      tipo: "auto" as const,
      titulo: `${v.marca} ${v.modelo} ${v.anio}`,
      detalle: `${v.dominio ?? "Sin patente"} · ${ETIQUETA_ESTADO[v.estado]}`,
      href: `/stock/${v.id}`,
    })),
    ...contactos.map((c) => ({
      tipo: "contacto" as const,
      titulo: `${c.nombre} ${c.apellido ?? ""}`.trim(),
      detalle: [c.telefono, c.etapa.toLowerCase()].filter(Boolean).join(" · "),
      href: `/contactos/${c.id}`,
    })),
    ...ventas.map((v) => ({
      tipo: "venta" as const,
      titulo: `${numeroOperacion(v.op.id)} · ${v.nombre} ${v.apellido ?? ""}`.trim(),
      detalle: `${v.marca} ${v.modelo} · ${ETIQUETA_OPERACION[v.op.estado]}`,
      href: `/ventas/${v.op.id}`,
    })),
  ];
}
