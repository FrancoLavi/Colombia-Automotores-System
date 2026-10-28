-- Cierra la API REST que Supabase expone automáticamente sobre el esquema public.
--
-- La app nunca usa esa API: entra directo a Postgres como "postgres", que es dueño de
-- las tablas y por lo tanto no queda afectado por RLS. Esto solo cierra la puerta de
-- afuera, donde cualquiera con la clave pública del proyecto podía leer los usuarios
-- (con sus hashes de contraseña), los clientes y la caja, y hasta borrarlos.
--
-- Sin políticas a propósito: "RLS activado y sin políticas" significa que nadie que no
-- sea el dueño entra, que es justo lo que se busca. Si algún día se agrega algo que sí
-- use esa API, ahí habrá que escribir políticas.
--
-- Se puede volver a correr sin problema, y en PGlite (desarrollo y tests) los roles de
-- Supabase no existen, así que esa parte se saltea sola.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    -- Para que las tablas que se creen de ahora en más tampoco nazcan abiertas.
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
  END IF;
END $$;
