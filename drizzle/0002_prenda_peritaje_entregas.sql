CREATE TABLE "gastos_venta" (
	"id" serial PRIMARY KEY NOT NULL,
	"operacion_id" integer NOT NULL,
	"concepto" text NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operaciones" ADD COLUMN "entrega_programada" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "operaciones" ADD COLUMN "lugar_entrega" text;--> statement-breakpoint
ALTER TABLE "peritajes" ADD COLUMN "costo" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "peritajes" ADD COLUMN "gasto_id" integer;--> statement-breakpoint
ALTER TABLE "tipos_documento" ADD COLUMN "solo_prendados" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD COLUMN "prendado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD COLUMN "prenda_detalle" text;--> statement-breakpoint
ALTER TABLE "gastos_venta" ADD CONSTRAINT "gastos_venta_operacion_id_operaciones_id_fk" FOREIGN KEY ("operacion_id") REFERENCES "public"."operaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "tipos_documento" ("nombre", "obligatorio", "tiene_vencimiento", "solo_prendados", "orden")
SELECT 'Cancelación de prenda', true, false, true, 50
WHERE NOT EXISTS (SELECT 1 FROM "tipos_documento" WHERE "solo_prendados");--> statement-breakpoint
INSERT INTO "categorias_gasto" ("nombre", "orden")
SELECT 'Peritaje', 0
WHERE NOT EXISTS (SELECT 1 FROM "categorias_gasto" WHERE "nombre" = 'Peritaje');
