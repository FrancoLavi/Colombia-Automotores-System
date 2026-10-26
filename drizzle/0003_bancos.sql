CREATE TABLE "bancos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO "bancos" ("nombre", "orden")
SELECT * FROM (VALUES
  ('Banco Nación', 1),
  ('Banco Provincia', 2),
  ('Banco Ciudad', 3),
  ('Santander', 4),
  ('Galicia', 5),
  ('BBVA', 6),
  ('Macro', 7),
  ('Patagonia', 8),
  ('Credicoop', 9),
  ('Supervielle', 10),
  ('ICBC', 11),
  ('Comafi', 12),
  ('Hipotecario', 13)
) AS v("nombre", "orden")
WHERE NOT EXISTS (SELECT 1 FROM "bancos");
