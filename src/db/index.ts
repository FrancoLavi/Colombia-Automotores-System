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
    return drizzlePostgres(
      postgres(url, {
        // El pooler de Supabase no admite consultas preparadas.
        prepare: false,
        // Una conexión por instancia. En Vercel cada visita puede levantar su propia
        // instancia, y el valor por defecto (10) hace que unas pocas acaparen todo el
        // pooler: el resto queda encolado hasta que Vercel corta a los 300 s.
        max: 1,
        // Soltar la conexión apenas deja de usarse, para devolverla al pooler.
        idle_timeout: 20,
        // Si aun así no hay lugar, fallar rápido y con un error claro en vez de colgarse.
        connect_timeout: 15,
      }),
      { schema },
    );
  }
  // Durante `next build` varios procesos importan este módulo a la vez: nunca deben abrir la base local en disco.
  if (process.env.NEXT_PHASE === "phase-production-build") return drizzlePglite("memory://", { schema });
  return drizzlePglite(process.env.PGLITE_DIR ?? "./.data/pglite", { schema });
}

type DB = ReturnType<typeof crear>;
const g = globalThis as unknown as { __db?: DB };
export const db: DB = g.__db ?? (g.__db = crear());
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
