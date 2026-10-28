CREATE TYPE "public"."tipo_distribucion" AS ENUM('CAPITAL', 'GANANCIA');--> statement-breakpoint
ALTER TYPE "public"."categoria_movimiento" ADD VALUE 'DEVOLUCION_CAPITAL' BEFORE 'APORTE';--> statement-breakpoint
ALTER TABLE "distribuciones" ADD COLUMN "tipo" "tipo_distribucion" DEFAULT 'GANANCIA' NOT NULL;