CREATE TABLE "recuperaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"vence" timestamp with time zone NOT NULL,
	"usado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recuperaciones_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "version_sesion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "intentos_fallidos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "bloqueado_hasta" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recuperaciones" ADD CONSTRAINT "recuperaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Tabla nueva cerrada a la API REST de Supabase, igual que el resto (ver 0005 y AGENTS.md → Producción).
ALTER TABLE "recuperaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.recuperaciones FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE public.recuperaciones_id_seq FROM anon, authenticated';
  END IF;
END $$;
