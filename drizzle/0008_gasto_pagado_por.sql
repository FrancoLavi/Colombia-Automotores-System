CREATE TYPE "public"."pagador_gasto" AS ENUM('SALON', 'DUENO');--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "pagado_por" "pagador_gasto" DEFAULT 'SALON' NOT NULL;