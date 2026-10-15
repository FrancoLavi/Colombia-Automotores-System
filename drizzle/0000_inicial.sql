CREATE TYPE "public"."accion_auditoria" AS ENUM('CREAR', 'MODIFICAR', 'ELIMINAR', 'CAMBIO_ESTADO');--> statement-breakpoint
CREATE TYPE "public"."categoria_movimiento" AS ENUM('COBRO_VENTA', 'SENIA', 'DEVOLUCION_SENIA', 'COBRO_CREDITO', 'PAGO_COMPRA', 'PAGO_CONSIGNANTE', 'GASTO_VEHICULO', 'GASTO_SALON', 'GASTO_EXTRAORDINARIO', 'RETIRO_SOCIO', 'PAGO_INVERSOR', 'APORTE', 'INGRESO_EXTRAORDINARIO', 'PAGO_CUENTA', 'COBRO_CUENTA', 'TRANSFERENCIA_INTERNA', 'AJUSTE');--> statement-breakpoint
CREATE TYPE "public"."estado_cuenta" AS ENUM('ABIERTA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."estado_distribucion" AS ENUM('PENDIENTE', 'PAGADO');--> statement-breakpoint
CREATE TYPE "public"."estado_documento" AS ENUM('PENDIENTE', 'RECIBIDO', 'NO_APLICA');--> statement-breakpoint
CREATE TYPE "public"."estado_gasto" AS ENUM('PAGADO', 'PENDIENTE');--> statement-breakpoint
CREATE TYPE "public"."estado_operacion" AS ENUM('PREVENTA', 'SENIADA', 'CERRADA', 'ENTREGADA', 'CAIDA');--> statement-breakpoint
CREATE TYPE "public"."estado_pago" AS ENUM('PENDIENTE', 'COBRADO', 'DEVUELTA', 'RETENIDA');--> statement-breakpoint
CREATE TYPE "public"."estado_pedido" AS ENUM('ABIERTO', 'CUMPLIDO', 'DESCARTADO');--> statement-breakpoint
CREATE TYPE "public"."estado_vehiculo" AS ENUM('POR_INGRESAR', 'DISPONIBLE', 'RESERVADO', 'VENDIDO', 'ENTREGADO', 'RECHAZADO', 'BAJA');--> statement-breakpoint
CREATE TYPE "public"."etapa_contacto" AS ENUM('DATO', 'PREVENTA', 'CLIENTE', 'DESCARTADO');--> statement-breakpoint
CREATE TYPE "public"."medio" AS ENUM('EFECTIVO', 'BANCO');--> statement-breakpoint
CREATE TYPE "public"."moneda" AS ENUM('ARS', 'USD');--> statement-breakpoint
CREATE TYPE "public"."origen_contacto" AS ENUM('WHATSAPP', 'FACEBOOK', 'MARKETPLACE', 'INSTAGRAM', 'REFERIDO', 'SALON', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."origen_cuenta" AS ENUM('CREDITO_BANCARIO', 'SALDO_COMPRA', 'CONSIGNANTE', 'GASTO', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."resultado_peritaje" AS ENUM('APTO', 'APTO_CON_OBS', 'NO_APTO');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('ADMIN', 'INVERSOR');--> statement-breakpoint
CREATE TYPE "public"."sentido" AS ENUM('INGRESO', 'EGRESO');--> statement-breakpoint
CREATE TYPE "public"."tipo_actividad" AS ENUM('LLAMADA', 'WHATSAPP', 'VISITA', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_archivo" AS ENUM('FOTO_PERITAJE', 'DOCUMENTO', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_cuenta" AS ENUM('A_COBRAR', 'A_PAGAR');--> statement-breakpoint
CREATE TYPE "public"."tipo_ingreso" AS ENUM('COMPRA', 'PERMUTA', 'CONSIGNACION');--> statement-breakpoint
CREATE TYPE "public"."tipo_pago" AS ENUM('SENIA', 'EFECTIVO', 'TRANSFERENCIA', 'CREDITO', 'PERMUTA', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_participe" AS ENUM('SALON', 'INVERSOR');--> statement-breakpoint
CREATE TYPE "public"."ubicacion" AS ENUM('SALON', 'CHAPISTA', 'ALISTAJE', 'MECANICO', 'OTRO');--> statement-breakpoint
CREATE TABLE "actividades" (
	"id" serial PRIMARY KEY NOT NULL,
	"contacto_id" integer NOT NULL,
	"vehiculo_id" integer,
	"tipo" "tipo_actividad" NOT NULL,
	"fecha_programada" timestamp with time zone NOT NULL,
	"realizada_en" timestamp with time zone,
	"nota" text,
	"usuario_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archivos" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehiculo_id" integer,
	"tipo" "tipo_archivo" NOT NULL,
	"url" text NOT NULL,
	"nombre" text,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" integer,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" integer NOT NULL,
	"accion" "accion_auditoria" NOT NULL,
	"cambios" jsonb,
	"descripcion" text
);
--> statement-breakpoint
CREATE TABLE "categorias_gasto" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contactos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text,
	"dni_cuit" text,
	"telefono" text,
	"email" text,
	"localidad" text,
	"origen" "origen_contacto" DEFAULT 'OTRO' NOT NULL,
	"etapa" "etapa_contacto" DEFAULT 'DATO' NOT NULL,
	"calificacion_monto" numeric(14, 2),
	"calificacion_banco" text,
	"producto_interes" text,
	"usado_a_entregar" text,
	"observaciones" text,
	"proximo_contacto" date,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuentas_pendientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" "tipo_cuenta" NOT NULL,
	"origen" "origen_cuenta" NOT NULL,
	"contraparte" text NOT NULL,
	"contacto_id" integer,
	"vehiculo_id" integer,
	"operacion_id" integer,
	"importe" numeric(14, 2) NOT NULL,
	"saldo" numeric(14, 2) NOT NULL,
	"vencimiento" date,
	"estado" "estado_cuenta" DEFAULT 'ABIERTA' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distribuciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"liquidacion_id" integer NOT NULL,
	"participe_id" integer NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"estado" "estado_distribucion" DEFAULT 'PENDIENTE' NOT NULL,
	"movimiento_id" integer
);
--> statement-breakpoint
CREATE TABLE "documentos_vehiculo" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehiculo_id" integer NOT NULL,
	"tipo_documento_id" integer NOT NULL,
	"estado" "estado_documento" DEFAULT 'PENDIENTE' NOT NULL,
	"fecha_recepcion" date,
	"fecha_vencimiento" date,
	"recibido_por" integer,
	"archivo_url" text
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehiculo_id" integer NOT NULL,
	"categoria_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"descripcion" text,
	"importe" numeric(14, 2) NOT NULL,
	"estado" "estado_gasto" NOT NULL,
	"extraordinario" boolean DEFAULT false NOT NULL,
	"movimiento_id" integer,
	"cuenta_pendiente_id" integer,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"operacion_id" integer NOT NULL,
	"participe_id" integer NOT NULL,
	"regla" text NOT NULL,
	"costo" numeric(14, 2) NOT NULL,
	"precio" numeric(14, 2) NOT NULL,
	"ganancia" numeric(14, 2) NOT NULL,
	"ganancia_base" numeric(14, 2) NOT NULL,
	"sobreprecio" numeric(14, 2) NOT NULL,
	"parte_inversor" numeric(14, 2) NOT NULL,
	"parte_salon" numeric(14, 2) NOT NULL,
	"tc_ingreso" numeric(12, 2) NOT NULL,
	"tc_venta" numeric(12, 2),
	"costo_usd" numeric(12, 2) NOT NULL,
	"venta_usd" numeric(12, 2),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liquidaciones_operacion_id_unique" UNIQUE("operacion_id")
);
--> statement-breakpoint
CREATE TABLE "movimientos_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"sentido" "sentido" NOT NULL,
	"medio" "medio" NOT NULL,
	"categoria" "categoria_movimiento" NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"concepto" text NOT NULL,
	"operacion_id" integer,
	"vehiculo_id" integer,
	"participe_id" integer,
	"cuenta_pendiente_id" integer,
	"usuario_id" integer,
	"anulado" boolean DEFAULT false NOT NULL,
	"motivo_anulacion" text
);
--> statement-breakpoint
CREATE TABLE "objetivos" (
	"periodo" text PRIMARY KEY NOT NULL,
	"unidades" integer NOT NULL,
	"ganancia" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"contacto_id" integer NOT NULL,
	"vehiculo_id" integer NOT NULL,
	"vendedor_id" integer,
	"estado" "estado_operacion" DEFAULT 'PREVENTA' NOT NULL,
	"fecha_preventa" date NOT NULL,
	"fecha_cierre" date,
	"fecha_entrega" timestamp with time zone,
	"precio_venta" numeric(14, 2) NOT NULL,
	"tc_venta" numeric(12, 2),
	"motivo_caida" text,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos_operacion" (
	"id" serial PRIMARY KEY NOT NULL,
	"operacion_id" integer NOT NULL,
	"tipo" "tipo_pago" NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"fecha" date NOT NULL,
	"medio" "medio",
	"banco" text,
	"vence" date,
	"vehiculo_permuta_id" integer,
	"estado" "estado_pago" NOT NULL,
	"movimiento_id" integer,
	"cuenta_pendiente_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametros" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_participe" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"contacto_id" integer NOT NULL,
	"marca" text,
	"modelo" text,
	"anio_desde" integer,
	"anio_hasta" integer,
	"presupuesto_max" numeric(14, 2),
	"notas" text,
	"estado" "estado_pedido" DEFAULT 'ABIERTO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peritajes" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehiculo_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"perito" text,
	"resultado" "resultado_peritaje" NOT NULL,
	"reparacion_estimada" numeric(14, 2),
	"observaciones" text,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "peritajes_vehiculo_id_unique" UNIQUE("vehiculo_id")
);
--> statement-breakpoint
CREATE TABLE "tipos_cambio" (
	"fecha" date PRIMARY KEY NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"usuario_id" integer
);
--> statement-breakpoint
CREATE TABLE "tipos_documento" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"obligatorio" boolean DEFAULT true NOT NULL,
	"tiene_vencimiento" boolean DEFAULT false NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" DEFAULT 'ADMIN' NOT NULL,
	"participe_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehiculos" (
	"id" serial PRIMARY KEY NOT NULL,
	"dominio" text,
	"chasis" text,
	"nro_motor" text,
	"marca" text NOT NULL,
	"modelo" text NOT NULL,
	"version" text,
	"anio" integer NOT NULL,
	"km" integer,
	"color" text,
	"combustible" text,
	"transmision" text,
	"tipo_ingreso" "tipo_ingreso" NOT NULL,
	"estado" "estado_vehiculo" DEFAULT 'POR_INGRESAR' NOT NULL,
	"ubicacion" "ubicacion" DEFAULT 'SALON' NOT NULL,
	"participe_id" integer NOT NULL,
	"ingresado_por" text,
	"contacto_origen_id" integer,
	"operacion_origen_id" integer,
	"fecha_ingreso" date NOT NULL,
	"fecha_disponible" date,
	"moneda_compra" "moneda" DEFAULT 'ARS' NOT NULL,
	"valor_compra_usd" numeric(12, 2),
	"valor_compra_ars" numeric(14, 2) NOT NULL,
	"tc_ingreso" numeric(12, 2) NOT NULL,
	"ajuste_precio" numeric(14, 2) DEFAULT 0 NOT NULL,
	"precio_publicado" numeric(14, 2),
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_pendientes" ADD CONSTRAINT "cuentas_pendientes_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_pendientes" ADD CONSTRAINT "cuentas_pendientes_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_pendientes" ADD CONSTRAINT "cuentas_pendientes_operacion_id_operaciones_id_fk" FOREIGN KEY ("operacion_id") REFERENCES "public"."operaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribuciones" ADD CONSTRAINT "distribuciones_liquidacion_id_liquidaciones_id_fk" FOREIGN KEY ("liquidacion_id") REFERENCES "public"."liquidaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribuciones" ADD CONSTRAINT "distribuciones_participe_id_participes_id_fk" FOREIGN KEY ("participe_id") REFERENCES "public"."participes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_vehiculo" ADD CONSTRAINT "documentos_vehiculo_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_vehiculo" ADD CONSTRAINT "documentos_vehiculo_tipo_documento_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_documento_id") REFERENCES "public"."tipos_documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_vehiculo" ADD CONSTRAINT "documentos_vehiculo_recibido_por_usuarios_id_fk" FOREIGN KEY ("recibido_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_categorias_gasto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_gasto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_operacion_id_operaciones_id_fk" FOREIGN KEY ("operacion_id") REFERENCES "public"."operaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_participe_id_participes_id_fk" FOREIGN KEY ("participe_id") REFERENCES "public"."participes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_operacion_id_operaciones_id_fk" FOREIGN KEY ("operacion_id") REFERENCES "public"."operaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_participe_id_participes_id_fk" FOREIGN KEY ("participe_id") REFERENCES "public"."participes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_cuenta_pendiente_id_cuentas_pendientes_id_fk" FOREIGN KEY ("cuenta_pendiente_id") REFERENCES "public"."cuentas_pendientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operaciones" ADD CONSTRAINT "operaciones_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operaciones" ADD CONSTRAINT "operaciones_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operaciones" ADD CONSTRAINT "operaciones_vendedor_id_usuarios_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_operacion" ADD CONSTRAINT "pagos_operacion_operacion_id_operaciones_id_fk" FOREIGN KEY ("operacion_id") REFERENCES "public"."operaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_operacion" ADD CONSTRAINT "pagos_operacion_vehiculo_permuta_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_permuta_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peritajes" ADD CONSTRAINT "peritajes_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peritajes" ADD CONSTRAINT "peritajes_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_cambio" ADD CONSTRAINT "tipos_cambio_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_participe_id_participes_id_fk" FOREIGN KEY ("participe_id") REFERENCES "public"."participes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_participe_id_participes_id_fk" FOREIGN KEY ("participe_id") REFERENCES "public"."participes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_contacto_origen_id_contactos_id_fk" FOREIGN KEY ("contacto_origen_id") REFERENCES "public"."contactos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "auditoria_fecha_idx" ON "auditoria" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "contactos_telefono_idx" ON "contactos" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "contactos_proximo_idx" ON "contactos" USING btree ("proximo_contacto");--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_vehiculo_uq" ON "documentos_vehiculo" USING btree ("vehiculo_id","tipo_documento_id");--> statement-breakpoint
CREATE INDEX "gastos_vehiculo_idx" ON "gastos" USING btree ("vehiculo_id");--> statement-breakpoint
CREATE INDEX "movimientos_fecha_idx" ON "movimientos_caja" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "operaciones_estado_idx" ON "operaciones" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "vehiculos_dominio_uq" ON "vehiculos" USING btree ("dominio");--> statement-breakpoint
CREATE INDEX "vehiculos_estado_idx" ON "vehiculos" USING btree ("estado");