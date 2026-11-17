CREATE TYPE "public"."estado_valor" AS ENUM('EN_CARTERA', 'DEPOSITADO', 'ACREDITADO', 'ENDOSADO', 'RECHAZADO', 'INCOBRABLE');--> statement-breakpoint
CREATE TYPE "public"."tipo_valor" AS ENUM('CHEQUE', 'PAGARE');--> statement-breakpoint
ALTER TYPE "public"."origen_cuenta" ADD VALUE 'VALOR' BEFORE 'MANUAL';--> statement-breakpoint
ALTER TYPE "public"."tipo_pago" ADD VALUE 'CHEQUE' BEFORE 'PERMUTA';--> statement-breakpoint
CREATE TABLE "valores" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" "tipo_valor" DEFAULT 'CHEQUE' NOT NULL,
	"numero" text,
	"banco" text,
	"librador" text,
	"librador_cuit" text,
	"importe" numeric(14, 2) NOT NULL,
	"fecha_emision" date,
	"fecha_pago" date NOT NULL,
	"estado" "estado_valor" DEFAULT 'EN_CARTERA' NOT NULL,
	"contacto_id" integer,
	"recibido_de" text,
	"operacion_id" integer,
	"pago_operacion_id" integer,
	"cuenta_pendiente_id" integer,
	"endosado_a" text,
	"cuenta_pagada_id" integer,
	"fecha_endoso" date,
	"notas" text,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "valores" ADD CONSTRAINT "valores_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valores" ADD CONSTRAINT "valores_operacion_id_operaciones_id_fk" FOREIGN KEY ("operacion_id") REFERENCES "public"."operaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valores" ADD CONSTRAINT "valores_cuenta_pendiente_id_cuentas_pendientes_id_fk" FOREIGN KEY ("cuenta_pendiente_id") REFERENCES "public"."cuentas_pendientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valores" ADD CONSTRAINT "valores_cuenta_pagada_id_cuentas_pendientes_id_fk" FOREIGN KEY ("cuenta_pagada_id") REFERENCES "public"."cuentas_pendientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valores" ADD CONSTRAINT "valores_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;