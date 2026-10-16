// Prepara la base en memoria para un test de integración: migraciones + datos base.
import { migrate } from "drizzle-orm/pglite/migrator";
import { db, schema as s } from "@/db";

export async function prepararBase() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- en tests db es siempre PGlite
  await migrate(db as any, { migrationsFolder: "./drizzle" });
  await db.insert(s.participes).values([
    { nombre: "Salón", tipo: "SALON" },
    { nombre: "Inversor", tipo: "INVERSOR" },
  ]);
  await db.insert(s.usuarios).values({ nombre: "Prueba", email: "prueba@local.test", passwordHash: "x" });
  await db.insert(s.tiposDocumento).values([
    { nombre: "Título", orden: 1 },
    { nombre: "VTV", orden: 2, tieneVencimiento: true },
  ]);
  await db.insert(s.categoriasGasto).values([{ nombre: "Chapa y pintura", orden: 1 }]);
}
