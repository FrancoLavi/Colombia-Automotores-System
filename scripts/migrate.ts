// Aplica las migraciones de ./drizzle a la base configurada (DATABASE_URL o PGlite local).
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { mkdirSync } from "node:fs";

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: 1, prepare: false });
    await migratePostgres(drizzlePostgres(client), { migrationsFolder: "./drizzle" });
    await client.end();
  } else {
    const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
    mkdirSync(dir, { recursive: true });
    const db = drizzlePglite(dir);
    await migratePglite(db, { migrationsFolder: "./drizzle" });
    await db.$client.close();
  }
  console.log("Migraciones aplicadas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
