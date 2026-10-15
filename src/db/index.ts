import "server-only";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

// Producción: DATABASE_URL (Supabase). Desarrollo: PGlite embebido en ./.data/pglite.
function crear() {
  const url = process.env.DATABASE_URL;
  if (url) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres");
    return drizzlePostgres(postgres(url, { prepare: false }), { schema });
  }
  return drizzlePglite(process.env.PGLITE_DIR ?? "./.data/pglite", { schema });
}

type DB = ReturnType<typeof crear>;
const g = globalThis as unknown as { __db?: DB };
export const db: DB = g.__db ?? (g.__db = crear());
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
