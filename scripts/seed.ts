// Datos base: participes, papeles obligatorios, categorías de gasto, parámetros y el usuario inicial.
// El usuario inicial se toma de SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (ver .env.example).
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import * as s from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  const client = url ? postgres(url, { max: 1, prepare: false }) : null;
  const db = client ? drizzlePostgres(client, { schema: s }) : drizzlePglite(process.env.PGLITE_DIR ?? "./.data/pglite", { schema: s });

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.participes);
  if (n === 0) {
    // Los nombres de los inversores vienen de SEED_INVERSORES (lista separada por comas) para no versionarlos.
    const inversores = (process.env.SEED_INVERSORES ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    await db.insert(s.participes).values([
      { nombre: "Salón", tipo: "SALON" as const },
      ...inversores.map((nombre) => ({ nombre, tipo: "INVERSOR" as const })),
    ]);
    await db.insert(s.tiposDocumento).values([
      { nombre: "Título", orden: 1 },
      { nombre: "Formulario 08 firmado", orden: 2 },
      { nombre: "Cédula", orden: 3 },
      { nombre: "Informe de dominio", orden: 4 },
      { nombre: "VTV", orden: 5, tieneVencimiento: true },
      { nombre: "Verificación policial", orden: 6, tieneVencimiento: true },
      { nombre: "Libre deuda de patentes y multas", orden: 7 },
      { nombre: "Duplicado de llaves", orden: 8, obligatorio: false },
    ]);
    await db.insert(s.categoriasGasto).values(
      ["Chapa y pintura", "Alistaje", "Mecánica", "Gestoría", "Patente", "Multa", "VTV", "Verificación", "Lavado", "Otros"].map(
        (nombre, i) => ({ nombre, orden: i + 1 }),
      ),
    );
    await db.insert(s.parametros).values([
      { clave: "margen_base", valor: "0.15" },
      { clave: "umbral_margen_usd", valor: "0.10" },
      { clave: "dias_alerta_stock", valor: "30" },
      { clave: "dias_alerta_stock_critica", valor: "60" },
      { clave: "dias_aviso_vencimiento", valor: "15" },
    ]);
    console.log("Datos base cargados.");
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const existe = await db.query.usuarios.findFirst({ where: (u, { eq }) => eq(u.email, email) });
    if (!existe) {
      await db.insert(s.usuarios).values({
        nombre: process.env.SEED_ADMIN_NOMBRE ?? "Administrador",
        email,
        passwordHash: await bcrypt.hash(password, 10),
        rol: "ADMIN",
      });
      console.log(`Usuario inicial creado: ${email}`);
    }
  }
  if (client) await client.end();
  else await (db as ReturnType<typeof drizzlePglite>).$client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
