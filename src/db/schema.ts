import {
  pgTable,
  pgEnum,
  serial,
  bigserial,
  integer,
  text,
  boolean,
  numeric,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Importes en pesos: numeric(14,2). Tipos de cambio: numeric(12,2).
const pesos = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const tc = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });
const creadoEn = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();

// ---------- Enums ----------
export const rolEnum = pgEnum("rol", ["ADMIN", "INVERSOR"]);
export const accionAuditoriaEnum = pgEnum("accion_auditoria", ["CREAR", "MODIFICAR", "ELIMINAR", "CAMBIO_ESTADO"]);
export const tipoParticipeEnum = pgEnum("tipo_participe", ["SALON", "INVERSOR"]);

export const origenContactoEnum = pgEnum("origen_contacto", [
  "WHATSAPP", "FACEBOOK", "MARKETPLACE", "INSTAGRAM", "REFERIDO", "SALON", "OTRO",
]);
export const etapaContactoEnum = pgEnum("etapa_contacto", ["DATO", "PREVENTA", "CLIENTE", "DESCARTADO"]);
export const tipoActividadEnum = pgEnum("tipo_actividad", ["LLAMADA", "WHATSAPP", "VISITA", "OTRO"]);
export const estadoPedidoEnum = pgEnum("estado_pedido", ["ABIERTO", "CUMPLIDO", "DESCARTADO"]);

export const tipoIngresoEnum = pgEnum("tipo_ingreso", ["COMPRA", "PERMUTA", "CONSIGNACION"]);
export const estadoVehiculoEnum = pgEnum("estado_vehiculo", [
  "POR_INGRESAR", "DISPONIBLE", "RESERVADO", "VENDIDO", "ENTREGADO", "RECHAZADO", "BAJA",
]);
export const ubicacionEnum = pgEnum("ubicacion", ["SALON", "CHAPISTA", "ALISTAJE", "MECANICO", "OTRO"]);
export const monedaEnum = pgEnum("moneda", ["ARS", "USD"]);
export const estadoDocumentoEnum = pgEnum("estado_documento", ["PENDIENTE", "RECIBIDO", "NO_APLICA"]);
export const resultadoPeritajeEnum = pgEnum("resultado_peritaje", ["APTO", "APTO_CON_OBS", "NO_APTO"]);
export const tipoArchivoEnum = pgEnum("tipo_archivo", ["FOTO_PERITAJE", "DOCUMENTO", "OTRO"]);
export const estadoGastoEnum = pgEnum("estado_gasto", ["PAGADO", "PENDIENTE"]);

export const estadoOperacionEnum = pgEnum("estado_operacion", ["PREVENTA", "SENIADA", "CERRADA", "ENTREGADA", "CAIDA"]);
export const tipoPagoEnum = pgEnum("tipo_pago", ["SENIA", "EFECTIVO", "TRANSFERENCIA", "CREDITO", "PERMUTA", "OTRO"]);
export const estadoPagoEnum = pgEnum("estado_pago", ["PENDIENTE", "COBRADO", "DEVUELTA", "RETENIDA"]);
export const estadoDistribucionEnum = pgEnum("estado_distribucion", ["PENDIENTE", "PAGADO"]);

export const sentidoEnum = pgEnum("sentido", ["INGRESO", "EGRESO"]);
export const medioEnum = pgEnum("medio", ["EFECTIVO", "BANCO"]);
export const categoriaMovimientoEnum = pgEnum("categoria_movimiento", [
  "COBRO_VENTA", "SENIA", "DEVOLUCION_SENIA", "COBRO_CREDITO",
  "PAGO_COMPRA", "PAGO_CONSIGNANTE", "GASTO_VEHICULO", "GASTO_SALON", "GASTO_EXTRAORDINARIO",
  "RETIRO_SOCIO", "PAGO_INVERSOR", "APORTE", "INGRESO_EXTRAORDINARIO", "PAGO_CUENTA", "COBRO_CUENTA",
  "TRANSFERENCIA_INTERNA", "AJUSTE",
]);
export const tipoCuentaEnum = pgEnum("tipo_cuenta", ["A_COBRAR", "A_PAGAR"]);
export const origenCuentaEnum = pgEnum("origen_cuenta", ["CREDITO_BANCARIO", "SALDO_COMPRA", "CONSIGNANTE", "GASTO", "MANUAL"]);
export const estadoCuentaEnum = pgEnum("estado_cuenta", ["ABIERTA", "CANCELADA"]);

// ---------- Usuarios y auditoría ----------
export const participes = pgTable("participes", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  tipo: tipoParticipeEnum("tipo").notNull(),
  activo: boolean("activo").notNull().default(true),
  creadoEn: creadoEn(),
});

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rol: rolEnum("rol").notNull().default("ADMIN"),
  participeId: integer("participe_id").references(() => participes.id),
  activo: boolean("activo").notNull().default(true),
  creadoEn: creadoEn(),
});

export const auditoria = pgTable(
  "auditoria",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    entidad: text("entidad").notNull(),
    entidadId: integer("entidad_id").notNull(),
    accion: accionAuditoriaEnum("accion").notNull(),
    // { campo: [valorAnterior, valorNuevo] }
    cambios: jsonb("cambios").$type<Record<string, [unknown, unknown]>>(),
    descripcion: text("descripcion"),
  },
  (t) => [index("auditoria_entidad_idx").on(t.entidad, t.entidadId), index("auditoria_fecha_idx").on(t.fecha)],
);

// ---------- Contactos ----------
export const contactos = pgTable(
  "contactos",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    apellido: text("apellido"),
    dniCuit: text("dni_cuit"),
    telefono: text("telefono"),
    email: text("email"),
    localidad: text("localidad"),
    origen: origenContactoEnum("origen").notNull().default("OTRO"),
    etapa: etapaContactoEnum("etapa").notNull().default("DATO"),
    calificacionMonto: pesos("calificacion_monto"),
    calificacionBanco: text("calificacion_banco"),
    productoInteres: text("producto_interes"),
    usadoAEntregar: text("usado_a_entregar"),
    observaciones: text("observaciones"),
    proximoContacto: date("proximo_contacto"),
    creadoPor: integer("creado_por").references(() => usuarios.id),
    creadoEn: creadoEn(),
  },
  (t) => [index("contactos_telefono_idx").on(t.telefono), index("contactos_proximo_idx").on(t.proximoContacto)],
);

export const actividades = pgTable("actividades", {
  id: serial("id").primaryKey(),
  contactoId: integer("contacto_id").notNull().references(() => contactos.id),
  vehiculoId: integer("vehiculo_id"),
  tipo: tipoActividadEnum("tipo").notNull(),
  fechaProgramada: timestamp("fecha_programada", { withTimezone: true }).notNull(),
  realizadaEn: timestamp("realizada_en", { withTimezone: true }),
  nota: text("nota"),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  creadoEn: creadoEn(),
});

export const pedidos = pgTable("pedidos", {
  id: serial("id").primaryKey(),
  contactoId: integer("contacto_id").notNull().references(() => contactos.id),
  marca: text("marca"),
  modelo: text("modelo"),
  anioDesde: integer("anio_desde"),
  anioHasta: integer("anio_hasta"),
  presupuestoMax: pesos("presupuesto_max"),
  notas: text("notas"),
  estado: estadoPedidoEnum("estado").notNull().default("ABIERTO"),
  creadoEn: creadoEn(),
});

// ---------- Vehículos ----------
export const vehiculos = pgTable(
  "vehiculos",
  {
    id: serial("id").primaryKey(),
    dominio: text("dominio"),
    chasis: text("chasis"),
    nroMotor: text("nro_motor"),
    marca: text("marca").notNull(),
    modelo: text("modelo").notNull(),
    version: text("version"),
    anio: integer("anio").notNull(),
    km: integer("km"),
    color: text("color"),
    combustible: text("combustible"),
    transmision: text("transmision"),
    tipoIngreso: tipoIngresoEnum("tipo_ingreso").notNull(),
    estado: estadoVehiculoEnum("estado").notNull().default("POR_INGRESAR"),
    ubicacion: ubicacionEnum("ubicacion").notNull().default("SALON"),
    // Quién financia: un inversor o el propio salón (en consignación, el salón).
    participeId: integer("participe_id").notNull().references(() => participes.id),
    // "Lo ingresó": quién trajo el negocio. Informativo.
    ingresadoPor: text("ingresado_por"),
    // Vendedor del auto (compra) o dueño (consignación).
    contactoOrigenId: integer("contacto_origen_id").references(() => contactos.id),
    // Si entró como permuta, la operación de venta que lo originó.
    operacionOrigenId: integer("operacion_origen_id"),
    fechaIngreso: date("fecha_ingreso").notNull(),
    fechaDisponible: date("fecha_disponible"),
    monedaCompra: monedaEnum("moneda_compra").notNull().default("ARS"),
    // En consignación: monto pactado con el dueño.
    valorCompraUsd: numeric("valor_compra_usd", { precision: 12, scale: 2, mode: "number" }),
    valorCompraArs: pesos("valor_compra_ars").notNull(),
    // Dólar blue fijado al ingreso; vale para toda la operación.
    tcIngreso: tc("tc_ingreso").notNull(),
    ajustePrecio: pesos("ajuste_precio").notNull().default(0),
    precioPublicado: pesos("precio_publicado"),
    observaciones: text("observaciones"),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("vehiculos_dominio_uq").on(t.dominio), index("vehiculos_estado_idx").on(t.estado)],
);

export const tiposDocumento = pgTable("tipos_documento", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  obligatorio: boolean("obligatorio").notNull().default(true),
  tieneVencimiento: boolean("tiene_vencimiento").notNull().default(false),
  orden: integer("orden").notNull().default(0),
  activo: boolean("activo").notNull().default(true),
});

export const documentosVehiculo = pgTable(
  "documentos_vehiculo",
  {
    id: serial("id").primaryKey(),
    vehiculoId: integer("vehiculo_id").notNull().references(() => vehiculos.id),
    tipoDocumentoId: integer("tipo_documento_id").notNull().references(() => tiposDocumento.id),
    estado: estadoDocumentoEnum("estado").notNull().default("PENDIENTE"),
    fechaRecepcion: date("fecha_recepcion"),
    fechaVencimiento: date("fecha_vencimiento"),
    recibidoPor: integer("recibido_por").references(() => usuarios.id),
    archivoUrl: text("archivo_url"),
  },
  (t) => [uniqueIndex("documentos_vehiculo_uq").on(t.vehiculoId, t.tipoDocumentoId)],
);

export const peritajes = pgTable("peritajes", {
  id: serial("id").primaryKey(),
  vehiculoId: integer("vehiculo_id").notNull().unique().references(() => vehiculos.id),
  fecha: date("fecha").notNull(),
  perito: text("perito"),
  resultado: resultadoPeritajeEnum("resultado").notNull(),
  reparacionEstimada: pesos("reparacion_estimada"),
  observaciones: text("observaciones"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: creadoEn(),
});

export const archivos = pgTable("archivos", {
  id: serial("id").primaryKey(),
  vehiculoId: integer("vehiculo_id").references(() => vehiculos.id),
  tipo: tipoArchivoEnum("tipo").notNull(),
  url: text("url").notNull(),
  nombre: text("nombre"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: creadoEn(),
});

export const categoriasGasto = pgTable("categorias_gasto", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  orden: integer("orden").notNull().default(0),
  activo: boolean("activo").notNull().default(true),
});

export const gastos = pgTable(
  "gastos",
  {
    id: serial("id").primaryKey(),
    vehiculoId: integer("vehiculo_id").notNull().references(() => vehiculos.id),
    categoriaId: integer("categoria_id").notNull().references(() => categoriasGasto.id),
    fecha: date("fecha").notNull(),
    descripcion: text("descripcion"),
    importe: pesos("importe").notNull(),
    estado: estadoGastoEnum("estado").notNull(),
    // Gasto aparecido después de la venta: lo asume el salón y no suma al costo (R6).
    extraordinario: boolean("extraordinario").notNull().default(false),
    movimientoId: integer("movimiento_id"),
    cuentaPendienteId: integer("cuenta_pendiente_id"),
    creadoPor: integer("creado_por").references(() => usuarios.id),
    creadoEn: creadoEn(),
  },
  (t) => [index("gastos_vehiculo_idx").on(t.vehiculoId)],
);

// ---------- Operaciones de venta ----------
export const operaciones = pgTable(
  "operaciones",
  {
    id: serial("id").primaryKey(),
    contactoId: integer("contacto_id").notNull().references(() => contactos.id),
    vehiculoId: integer("vehiculo_id").notNull().references(() => vehiculos.id),
    vendedorId: integer("vendedor_id").references(() => usuarios.id),
    estado: estadoOperacionEnum("estado").notNull().default("PREVENTA"),
    fechaPreventa: date("fecha_preventa").notNull(),
    fechaCierre: date("fecha_cierre"),
    fechaEntrega: timestamp("fecha_entrega", { withTimezone: true }),
    precioVenta: pesos("precio_venta").notNull(),
    // Blue del día de la venta: solo referencia (R5).
    tcVenta: tc("tc_venta"),
    motivoCaida: text("motivo_caida"),
    observaciones: text("observaciones"),
    creadoEn: creadoEn(),
  },
  (t) => [index("operaciones_estado_idx").on(t.estado)],
);

export const pagosOperacion = pgTable("pagos_operacion", {
  id: serial("id").primaryKey(),
  operacionId: integer("operacion_id").notNull().references(() => operaciones.id),
  tipo: tipoPagoEnum("tipo").notNull(),
  importe: pesos("importe").notNull(),
  fecha: date("fecha").notNull(),
  medio: medioEnum("medio"),
  banco: text("banco"),
  // Seña: hasta cuándo reserva el auto.
  vence: date("vence"),
  vehiculoPermutaId: integer("vehiculo_permuta_id").references(() => vehiculos.id),
  estado: estadoPagoEnum("estado").notNull(),
  movimientoId: integer("movimiento_id"),
  cuentaPendienteId: integer("cuenta_pendiente_id"),
  creadoEn: creadoEn(),
});

export const liquidaciones = pgTable("liquidaciones", {
  id: serial("id").primaryKey(),
  operacionId: integer("operacion_id").notNull().unique().references(() => operaciones.id),
  participeId: integer("participe_id").notNull().references(() => participes.id),
  regla: text("regla").notNull(),
  costo: pesos("costo").notNull(),
  precio: pesos("precio").notNull(),
  ganancia: pesos("ganancia").notNull(),
  gananciaBase: pesos("ganancia_base").notNull(),
  sobreprecio: pesos("sobreprecio").notNull(),
  parteInversor: pesos("parte_inversor").notNull(),
  parteSalon: pesos("parte_salon").notNull(),
  tcIngreso: tc("tc_ingreso").notNull(),
  tcVenta: tc("tc_venta"),
  costoUsd: numeric("costo_usd", { precision: 12, scale: 2, mode: "number" }).notNull(),
  ventaUsd: numeric("venta_usd", { precision: 12, scale: 2, mode: "number" }),
  creadoEn: creadoEn(),
});

export const distribuciones = pgTable("distribuciones", {
  id: serial("id").primaryKey(),
  liquidacionId: integer("liquidacion_id").notNull().references(() => liquidaciones.id),
  participeId: integer("participe_id").notNull().references(() => participes.id),
  importe: pesos("importe").notNull(),
  estado: estadoDistribucionEnum("estado").notNull().default("PENDIENTE"),
  movimientoId: integer("movimiento_id"),
});

// ---------- Caja y cuentas ----------
export const cuentasPendientes = pgTable("cuentas_pendientes", {
  id: serial("id").primaryKey(),
  tipo: tipoCuentaEnum("tipo").notNull(),
  origen: origenCuentaEnum("origen").notNull(),
  contraparte: text("contraparte").notNull(),
  contactoId: integer("contacto_id").references(() => contactos.id),
  vehiculoId: integer("vehiculo_id").references(() => vehiculos.id),
  operacionId: integer("operacion_id").references(() => operaciones.id),
  importe: pesos("importe").notNull(),
  saldo: pesos("saldo").notNull(),
  vencimiento: date("vencimiento"),
  estado: estadoCuentaEnum("estado").notNull().default("ABIERTA"),
  notas: text("notas"),
  creadoEn: creadoEn(),
});

export const movimientosCaja = pgTable(
  "movimientos_caja",
  {
    id: serial("id").primaryKey(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    sentido: sentidoEnum("sentido").notNull(),
    medio: medioEnum("medio").notNull(),
    categoria: categoriaMovimientoEnum("categoria").notNull(),
    importe: pesos("importe").notNull(),
    concepto: text("concepto").notNull(),
    operacionId: integer("operacion_id").references(() => operaciones.id),
    vehiculoId: integer("vehiculo_id").references(() => vehiculos.id),
    participeId: integer("participe_id").references(() => participes.id),
    cuentaPendienteId: integer("cuenta_pendiente_id").references(() => cuentasPendientes.id),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    anulado: boolean("anulado").notNull().default(false),
    motivoAnulacion: text("motivo_anulacion"),
  },
  (t) => [index("movimientos_fecha_idx").on(t.fecha)],
);

// ---------- Configuración ----------
export const tiposCambio = pgTable("tipos_cambio", {
  fecha: date("fecha").primaryKey(),
  valor: tc("valor").notNull(),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
});

export const objetivos = pgTable("objetivos", {
  periodo: text("periodo").primaryKey(), // "AAAA-MM"
  unidades: integer("unidades").notNull(),
  ganancia: pesos("ganancia").notNull(),
});

export const parametros = pgTable("parametros", {
  clave: text("clave").primaryKey(),
  valor: text("valor").notNull(),
});
