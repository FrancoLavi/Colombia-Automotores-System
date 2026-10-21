CREATE TYPE "public"."rol_persona" AS ENUM('SOCIO', 'EMPLEADO');--> statement-breakpoint
ALTER TYPE "public"."categoria_movimiento" ADD VALUE 'SUELDO';--> statement-breakpoint
CREATE TABLE "personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"rol" "rol_persona" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD COLUMN "persona_id" integer;--> statement-breakpoint
ALTER TABLE "tipos_cambio" ADD COLUMN "fuente" text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;