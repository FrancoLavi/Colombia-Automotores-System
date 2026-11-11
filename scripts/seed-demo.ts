/**
 * Datos de demostración: un salón ficticio con cuatro meses de actividad, para mostrar el
 * sistema a alguien de afuera sin exponer clientes, autos ni plata reales.
 *
 *   npm run db:seed-demo     ← con el server APAGADO (ver abajo)
 *   npm run dev:demo         ← levanta la app contra esta base
 *
 * PGlite admite un solo proceso escribiendo: si se corre el seed con `dev:demo` levantado,
 * el server se queda con una vista vieja y las pantallas muestran todo en cero. Bajá el
 * server, corré el seed, y recién después volvé a levantarlo.
 *
 * Todo se genera **manejando el sistema**, con las mismas funciones que usan las pantallas:
 * no se insertan filas a mano. Por eso la demo cuadra sola, igual que producción, y cualquier
 * regla que se agregue al dominio se refleja acá sin tocar este archivo.
 *
 * Lo único que se escribe directo son las fechas, al final: `crearOperacion` y `tomarUsado`
 * fechan todo "hoy", y una demo donde todo pasó el mismo día deja Reportes vacío. Mover una
 * fecha no cambia ningún importe, así que la caja sigue cerrando.
 *
 * NUNCA corre contra producción: ver `protecciones()`.
 */

// Ojo con el orden: `src/db` arma la conexión al importarse, así que las variables de entorno
// tienen que estar puestas ANTES. Por eso todo lo demás entra por import() dinámico, abajo.
const DIRECTORIO_DEMO = "./.data/demo";

const SALIDA = {
  gris: (t: string) => `\x1b[90m${t}\x1b[0m`,
  verde: (t: string) => `\x1b[32m${t}\x1b[0m`,
  rojo: (t: string) => `\x1b[31m${t}\x1b[0m`,
  negrita: (t: string) => `\x1b[1m${t}\x1b[0m`,
};

function protecciones() {
  const url = process.env.DATABASE_URL;
  if (url && process.env.DEMO_CONFIRMO !== "1") {
    console.error(
      SALIDA.rojo("\n  DATABASE_URL está puesta y esto carga datos inventados.\n") +
        "  Si de verdad querés escribir en esa base, volvé a correrlo con DEMO_CONFIRMO=1.\n" +
        "  Sin DATABASE_URL usa una base local nueva en " +
        DIRECTORIO_DEMO +
        ", que es lo recomendado.\n",
    );
    process.exit(1);
  }
  if (!url) process.env.PGLITE_DIR = process.env.PGLITE_DIR ?? DIRECTORIO_DEMO;
  // La base de desarrollo de todos los días no es lugar para esto.
  if (process.env.PGLITE_DIR === "./.data/pglite") {
    console.error(SALIDA.rojo("\n  PGLITE_DIR apunta a la base de desarrollo. Usá otra carpeta.\n"));
    process.exit(1);
  }
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "demo".repeat(10);
  process.env.DOLAR_API = process.env.DOLAR_API ?? "off";
}

protecciones();

const PASSWORD_DEMO = process.env.DEMO_PASSWORD ?? "demo1234";
const EMAIL_DEMO = process.env.DEMO_EMAIL ?? "demo@salondemo.test";

// Hoy, para fechar la demo hacia atrás.
const HOY = new Date();
const diasAtras = (n: number) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Deja la base al día antes de cargar nada: una base de demo nueva no tiene ni las tablas. */
async function migrar() {
  const { mkdirSync } = await import("node:fs");
  if (process.env.DATABASE_URL) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
    return;
  }
  const dir = process.env.PGLITE_DIR!;
  mkdirSync(dir, { recursive: true });
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const d = drizzle(dir);
  await migrate(d, { migrationsFolder: "./drizzle" });
  await d.$client.close();
}

async function main() {
  console.log(SALIDA.gris("  Aplicando migraciones…"));
  await migrar();

  const { db, schema: s } = await import("../src/db");
  const { sql, eq, and, inArray } = await import("drizzle-orm");
  const bcrypt = (await import("bcryptjs")).default;
  const { COSTO_BCRYPT } = await import("../src/domain/seguridad");
  const veh = await import("../src/server/vehiculos");
  const ventas = await import("../src/server/ventas");
  const caja = await import("../src/server/caja");
  const contactos = await import("../src/server/contactos");
  const config = await import("../src/server/configuracion");

  const [{ n: yaHay }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.vehiculos);
  if (yaHay > 0 && process.env.DEMO_RESET !== "1") {
    console.error(
      SALIDA.rojo(`\n  La base ya tiene ${yaHay} autos cargados: no la piso.\n`) +
        "  Si es una base de demo y la querés rehacer de cero, corré con DEMO_RESET=1.\n",
    );
    process.exit(1);
  }
  if (yaHay > 0) {
    console.log(SALIDA.gris("  Vaciando la base de demo…"));
    await db.execute(sql`
      truncate ${s.auditoria}, ${s.actividades}, ${s.pedidos}, ${s.archivos}, ${s.distribuciones},
               ${s.liquidaciones}, ${s.gastosVenta}, ${s.pagosOperacion}, ${s.operaciones},
               ${s.cuentasPendientes}, ${s.movimientosCaja}, ${s.gastos}, ${s.peritajes},
               ${s.documentosVehiculo}, ${s.vehiculos}, ${s.contactos}
      restart identity cascade`);
  }

  // ---------- Datos base ----------
  let salon = await db.query.participes.findFirst({ where: eq(s.participes.tipo, "SALON") });
  if (!salon) {
    [salon] = await db.insert(s.participes).values({ nombre: "Salón", tipo: "SALON" }).returning();
    await db.insert(s.tiposDocumento).values([
      { nombre: "Título", orden: 1 },
      { nombre: "Formulario 08 firmado", orden: 2 },
      { nombre: "Cédula", orden: 3 },
      { nombre: "Informe de dominio", orden: 4 },
      { nombre: "VTV", orden: 5, tieneVencimiento: true },
      { nombre: "Verificación policial", orden: 6, tieneVencimiento: true },
      { nombre: "Libre deuda de patentes y multas", orden: 7 },
      { nombre: "Duplicado de llaves", orden: 8, obligatorio: false },
    ]);
    await db.insert(s.categoriasGasto).values(
      ["Chapa y pintura", "Alistaje", "Mecánica", "Gestoría", "Patente", "Multa", "VTV", "Verificación", "Lavado", "Otros"].map(
        (nombre, i) => ({ nombre, orden: i + 1 }),
      ),
    );
    await db.insert(s.parametros).values([
      { clave: "margen_base", valor: "0.15" },
      { clave: "umbral_margen_usd", valor: "0.10" },
      { clave: "dias_alerta_stock", valor: "30" },
      { clave: "dias_alerta_stock_critica", valor: "60" },
      { clave: "dias_aviso_vencimiento", valor: "15" },
    ]);
  }
  const [{ nb }] = await db.select({ nb: sql<number>`count(*)::int` }).from(s.bancos);
  if (nb === 0) {
    await db.insert(s.bancos).values(
      ["Banco Nación", "Banco Provincia", "Santander", "Galicia", "BBVA", "Macro", "Credicoop"].map((nombre, i) => ({
        nombre,
        orden: i + 1,
      })),
    );
  }

  // Inversores de mentira. Si ya existen de una corrida anterior, se reusan.
  const inversor = async (nombre: string) => {
    const ya = await db.query.participes.findFirst({ where: eq(s.participes.nombre, nombre) });
    if (ya) return ya.id;
    const [p] = await db.insert(s.participes).values({ nombre, tipo: "INVERSOR" }).returning();
    return p.id;
  };
  const HECTOR = await inversor("Héctor Benítez");
  const SILVANA = await inversor("Silvana Rossi");

  // Usuario para entrar a la demo. Un nombre común y nada más: en una captura o un video,
  // "Usuario de demostración" delata que es una maqueta. Es el mismo nombre que el socio, para
  // que cierre con el resto de la demo.
  const NOMBRE_DEMO = "Daniel Soler";
  let usuario = await db.query.usuarios.findFirst({ where: eq(s.usuarios.email, EMAIL_DEMO) });
  if (!usuario) {
    [usuario] = await db
      .insert(s.usuarios)
      .values({
        nombre: NOMBRE_DEMO,
        email: EMAIL_DEMO,
        passwordHash: await bcrypt.hash(PASSWORD_DEMO, COSTO_BCRYPT),
        rol: "ADMIN",
      })
      .returning();
  } else if (usuario.nombre !== NOMBRE_DEMO) {
    // El DEMO_RESET no vacía `usuarios` (la auditoría les apunta), así que un usuario de una
    // corrida anterior sobrevive con su nombre viejo. Se actualiza acá.
    [usuario] = await db.update(s.usuarios).set({ nombre: NOMBRE_DEMO }).where(eq(s.usuarios.id, usuario.id)).returning();
  }
  const U = usuario.id;

  const [{ np }] = await db.select({ np: sql<number>`count(*)::int` }).from(s.personas);
  if (np === 0) {
    await config.crearPersona(U, "Daniel Soler", "SOCIO");
    await config.crearPersona(U, "Vanina Ortiz", "EMPLEADO");
  }
  const personas = await db.select().from(s.personas);
  const empleada = personas.find((p) => p.rol === "EMPLEADO") ?? personas[0];

  const categorias = await db.select().from(s.categoriasGasto);
  const cat = (nombre: string) => categorias.find((c) => c.nombre === nombre)!.id;

  // ---------- Caja inicial ----------
  // Sin esto el salón no puede comprar nada: K13 no deja que la caja quede en negativo.
  await caja.crearMovimiento(U, {
    categoria: "APORTE",
    sentido: null,
    medio: "BANCO",
    importe: 120_000_000,
    concepto: "Aporte inicial de los socios",
    fecha: diasAtras(130),
    participeId: null,
    personaId: personas.find((p) => p.rol === "SOCIO")?.id ?? null,
  });
  await caja.crearMovimiento(U, {
    categoria: "APORTE",
    sentido: null,
    medio: "EFECTIVO",
    importe: 15_000_000,
    concepto: "Fondo fijo del mostrador",
    fecha: diasAtras(130),
    participeId: null,
    personaId: personas.find((p) => p.rol === "SOCIO")?.id ?? null,
  });

  // ---------- Contactos ----------
  const CONTACTOS: {
    nombre: string;
    apellido: string;
    telefono: string;
    localidad: string;
    origen: "WHATSAPP" | "FACEBOOK" | "MARKETPLACE" | "INSTAGRAM" | "REFERIDO" | "SALON" | "OTRO";
    interes?: string;
  }[] = [
    { nombre: "Gustavo", apellido: "Medina", telefono: "2235550101", localidad: "Mar del Plata", origen: "MARKETPLACE", interes: "Hatchback chico, hasta $ 16.000.000" },
    { nombre: "Laura", apellido: "Quiroga", telefono: "2235550102", localidad: "Mar del Plata", origen: "WHATSAPP", interes: "SUV, con crédito" },
    { nombre: "Néstor", apellido: "Aguirre", telefono: "2235550103", localidad: "Balcarce", origen: "REFERIDO", interes: "Pick-up para el campo" },
    { nombre: "Mariela", apellido: "Sosa", telefono: "2235550104", localidad: "Miramar", origen: "INSTAGRAM", interes: "Primer auto, automático" },
    { nombre: "Ariel", apellido: "Peralta", telefono: "2235550105", localidad: "Mar del Plata", origen: "SALON", interes: "Entrega su Logan" },
    { nombre: "Cecilia", apellido: "Varela", telefono: "2235550106", localidad: "Necochea", origen: "FACEBOOK" },
    { nombre: "Rubén", apellido: "Ibáñez", telefono: "2235550107", localidad: "Mar del Plata", origen: "WHATSAPP", interes: "Sedán, efectivo" },
    { nombre: "Daniela", apellido: "Moreno", telefono: "2235550108", localidad: "Tandil", origen: "MARKETPLACE" },
    { nombre: "Fabián", apellido: "Ruiz", telefono: "2235550109", localidad: "Mar del Plata", origen: "REFERIDO", interes: "Deja en consignación su C3" },
    { nombre: "Patricia", apellido: "Leiva", telefono: "2235550110", localidad: "Mar del Plata", origen: "WHATSAPP" },
    { nombre: "Hernán", apellido: "Castro", telefono: "2235550111", localidad: "Batán", origen: "INSTAGRAM", interes: "Camioneta hasta $ 40.000.000" },
    { nombre: "Silvia", apellido: "Domínguez", telefono: "2235550112", localidad: "Mar del Plata", origen: "SALON" },
  ];
  const idContacto: Record<string, number> = {};
  for (const [i, c] of CONTACTOS.entries()) {
    idContacto[c.apellido] = await contactos.crearContacto(U, {
      nombre: c.nombre,
      apellido: c.apellido,
      dniCuit: null,
      telefono: c.telefono,
      email: null,
      localidad: c.localidad,
      origen: c.origen,
      calificacionMonto: null,
      calificacionBanco: null,
      productoInteres: c.interes ?? null,
      usadoMarca: null,
      usadoModelo: null,
      usadoAnio: null,
      usadoAEntregar: null,
      observaciones: null,
      // Algunos quedan con un recordatorio a futuro, para que la Agenda tenga contenido.
      // Dos para hoy (la Agenda arranca con algo) y algunos a futuro.
      proximoContacto: i < 2 ? iso(HOY) : i % 4 === 0 ? iso(diasAtras(-2 - i)) : null,
    });
  }

  // ---------- Autos ----------
  interface Auto {
    dominio: string;
    marca: string;
    modelo: string;
    version: string | null;
    anio: number;
    km: number;
    color: string;
    valor: number;
    financia: "SALON" | "HECTOR" | "SILVANA";
    tipo?: "COMPRA" | "CONSIGNACION";
    dias: number;
    gastos?: { categoria: string; descripcion: string; importe: number }[];
  }
  const AUTOS: Auto[] = [
    { dominio: "AB123CD", marca: "Toyota", modelo: "Etios", version: "XLS", anio: 2018, km: 78_000, color: "Gris", valor: 14_500_000, financia: "SALON", dias: 120,
      gastos: [{ categoria: "Alistaje", descripcion: "Lavado y pulido", importe: 180_000 }, { categoria: "Gestoría", descripcion: "Transferencia", importe: 620_000 }] },
    { dominio: "AC456EF", marca: "Volkswagen", modelo: "Gol Trend", version: "Comfortline", anio: 2016, km: 112_000, color: "Blanco", valor: 11_200_000, financia: "HECTOR", dias: 115,
      gastos: [{ categoria: "Mecánica", descripcion: "Correa y bomba de agua", importe: 540_000 }, { categoria: "Gestoría", descripcion: "Transferencia", importe: 480_000 }] },
    { dominio: "AD789GH", marca: "Ford", modelo: "EcoSport", version: "SE 1.5", anio: 2019, km: 64_000, color: "Rojo", valor: 19_800_000, financia: "HECTOR", dias: 96,
      gastos: [{ categoria: "Chapa y pintura", descripcion: "Paragolpes trasero", importe: 740_000 }, { categoria: "Gestoría", descripcion: "Transferencia", importe: 810_000 }] },
    { dominio: "AE012IJ", marca: "Chevrolet", modelo: "Onix", version: "LT", anio: 2020, km: 51_000, color: "Negro", valor: 21_500_000, financia: "SILVANA", dias: 88,
      gastos: [{ categoria: "Alistaje", descripcion: "Alistaje completo", importe: 260_000 }, { categoria: "Gestoría", descripcion: "Transferencia", importe: 890_000 }] },
    { dominio: "AF345KL", marca: "Renault", modelo: "Sandero", version: "Privilège", anio: 2017, km: 94_000, color: "Gris", valor: 12_900_000, financia: "SALON", dias: 74,
      gastos: [{ categoria: "VTV", descripcion: "VTV al día", importe: 95_000 }, { categoria: "Gestoría", descripcion: "Transferencia", importe: 530_000 }] },
    { dominio: "AG678MN", marca: "Peugeot", modelo: "208", version: "Allure", anio: 2021, km: 38_000, color: "Azul", valor: 24_300_000, financia: "SILVANA", dias: 52,
      gastos: [{ categoria: "Alistaje", descripcion: "Alistaje completo", importe: 240_000 }] },
    { dominio: "AH901OP", marca: "Fiat", modelo: "Cronos", version: "Drive 1.3", anio: 2022, km: 29_000, color: "Blanco", valor: 27_600_000, financia: "HECTOR", dias: 44,
      gastos: [{ categoria: "Gestoría", descripcion: "Transferencia", importe: 1_050_000 }] },
    { dominio: "AI234QR", marca: "Toyota", modelo: "Hilux", version: "SRV 4x4", anio: 2017, km: 143_000, color: "Gris oscuro", valor: 38_500_000, financia: "SILVANA", dias: 39,
      gastos: [{ categoria: "Mecánica", descripcion: "Service completo e inyectores", importe: 1_380_000 }] },
    { dominio: "AJ567ST", marca: "Honda", modelo: "HR-V", version: "EXL", anio: 2019, km: 67_000, color: "Plata", valor: 29_400_000, financia: "SALON", dias: 31,
      gastos: [{ categoria: "Alistaje", descripcion: "Alistaje completo", importe: 280_000 }] },
    { dominio: "AK890UV", marca: "Volkswagen", modelo: "Amarok", version: "Highline 4x4", anio: 2018, km: 121_000, color: "Negro", valor: 34_000_000, financia: "HECTOR", dias: 24,
      gastos: [{ categoria: "Mecánica", descripcion: "Embrague", importe: 1_620_000 }] },
    { dominio: "AL123WX", marca: "Citroën", modelo: "C3", version: "Feel", anio: 2016, km: 88_000, color: "Blanco", valor: 10_400_000, financia: "SALON", tipo: "CONSIGNACION", dias: 27 },
    { dominio: "AM456YZ", marca: "Nissan", modelo: "Versa", version: "Sense", anio: 2020, km: 46_000, color: "Gris", valor: 20_100_000, financia: "SALON", dias: 16,
      gastos: [{ categoria: "Alistaje", descripcion: "Alistaje completo", importe: 250_000 }] },
  ];

  const participeDe = { SALON: salon.id, HECTOR, SILVANA };
  const idAuto: Record<string, number> = {};

  /** Marca los papeles, carga el peritaje y habilita el auto: lo mismo que hace el salón a mano. */
  const habilitar = async (id: number, dias: number) => {
    const papeles = await db.select().from(s.documentosVehiculo).where(eq(s.documentosVehiculo.vehiculoId, id));
    for (const p of papeles) await veh.registrarDocumento(U, id, p.id, "RECIBIDO", null);
    await veh.guardarPeritaje(U, id, {
      fecha: iso(diasAtras(dias - 1)),
      perito: "Taller San Martín",
      resultado: "APTO",
      reparacionEstimada: null,
      observaciones: null,
    });
    await veh.habilitarVenta(U, id);
  };

  for (const a of AUTOS) {
    const id = await veh.crearVehiculo(
      U,
      {
        dominio: a.dominio,
        chasis: null,
        marca: a.marca,
        modelo: a.modelo,
        version: a.version,
        anio: a.anio,
        km: a.km,
        color: a.color,
        combustible: "Nafta",
        transmision: null,
        tipoIngreso: a.tipo ?? "COMPRA",
        participeId: participeDe[a.financia],
        ingresadoPor: null,
        contactoOrigenId: a.tipo === "CONSIGNACION" ? idContacto["Ruiz"] : null,
        fechaIngreso: iso(diasAtras(a.dias)),
        monedaCompra: "ARS",
        valorCompra: a.valor,
        tcIngreso: 1450,
        ubicacion: "SALON",
        observaciones: null,
      },
      a.financia === "SALON" && a.tipo !== "CONSIGNACION" ? { modo: "PAGADO", medio: "BANCO" } : { modo: "SIN_REGISTRO" },
    );
    idAuto[a.dominio] = id;
    for (const g of a.gastos ?? []) {
      await veh.agregarGasto(U, id, {
        categoriaId: cat(g.categoria),
        fecha: iso(diasAtras(a.dias - 2)),
        descripcion: g.descripcion,
        importe: g.importe,
        estado: "PAGADO",
        medio: "BANCO",
        pagadoPor: "SALON",
      });
    }
    await habilitar(id, a.dias);
  }

  // ---------- Ventas ----------
  const fechasOperacion: { id: number; dias: number }[] = [];

  /** Preventa + pagos + cierre + entrega, que es el camino normal de una venta. */
  async function vender(opts: {
    dominio: string;
    apellido: string;
    precio: number;
    dias: number;
    gastosVenta?: { concepto: string; importe: number }[];
    pagos: { tipo: "SENIA" | "EFECTIVO" | "TRANSFERENCIA" | "CREDITO" | "OTRO"; importe: number; banco?: string; cobrado?: boolean }[];
    usado?: { dominio: string; marca: string; modelo: string; anio: number; km: number; valor: number; aNombreDe: "SALON" | "HECTOR" | "SILVANA" };
    entregar?: boolean;
  }) {
    const opId = await ventas.crearOperacion(U, {
      contactoId: idContacto[opts.apellido],
      vehiculoId: idAuto[opts.dominio],
      precioVenta: opts.precio,
      observaciones: null,
    });
    for (const g of opts.gastosVenta ?? []) await ventas.agregarGastoVenta(U, opId, g.concepto, g.importe);
    if (opts.usado) {
      await ventas.tomarUsado(U, opId, {
        dominio: opts.usado.dominio,
        chasis: null,
        marca: opts.usado.marca,
        modelo: opts.usado.modelo,
        version: null,
        anio: opts.usado.anio,
        km: opts.usado.km,
        color: "Gris",
        combustible: "Nafta",
        transmision: null,
        participeId: participeDe[opts.usado.aNombreDe],
        ingresadoPor: null,
        fechaIngreso: iso(diasAtras(opts.dias)),
        monedaCompra: "ARS",
        valorCompra: opts.usado.valor,
        tcIngreso: 1450,
        ubicacion: "SALON",
        observaciones: null,
      });
    }
    for (const p of opts.pagos) {
      await ventas.agregarPago(U, opId, {
        tipo: p.tipo,
        importe: p.importe,
        fecha: iso(diasAtras(opts.dias)),
        medio: p.tipo === "EFECTIVO" ? "EFECTIVO" : "BANCO",
        banco: p.banco ?? null,
        vence: null,
        cobradoAhora: p.cobrado ?? true,
      });
    }
    // Los gastos de venta los paga el cliente además del precio, así que el total a cubrir es
    // mayor que `precio`. En vez de hacer esa cuenta a mano en cada venta de la lista, se
    // completa con una transferencia por lo que falte: es lo que pasaría en el mostrador.
    const ficha = (await ventas.fichaOperacion(opId))!;
    if (ficha.cobertura.faltante > 0) {
      await ventas.agregarPago(U, opId, {
        tipo: "TRANSFERENCIA",
        importe: ficha.cobertura.faltante,
        fecha: iso(diasAtras(opts.dias)),
        medio: "BANCO",
        banco: null,
        vence: null,
        cobradoAhora: true,
      });
    }
    await ventas.cerrarOperacion(U, opId, null);
    if (opts.entregar !== false) await ventas.entregarOperacion(U, opId, diasAtras(opts.dias - 2));
    fechasOperacion.push({ id: opId, dias: opts.dias });
    return opId;
  }

  // Venta simple del salón: efectivo y transferencia.
  await vender({
    dominio: "AB123CD", apellido: "Medina", precio: 17_900_000, dias: 104,
    gastosVenta: [{ concepto: "Gestoría de transferencia", importe: 640_000 }],
    pagos: [{ tipo: "SENIA", importe: 500_000 }, { tipo: "EFECTIVO", importe: 5_400_000 }],
  });

  // Venta de un auto de Héctor con crédito bancario: queda plata a cobrar hasta que el banco acredita.
  const opCredito = await vender({
    dominio: "AC456EF", apellido: "Quiroga", precio: 14_300_000, dias: 92,
    gastosVenta: [{ concepto: "Gastos del crédito", importe: 420_000 }],
    pagos: [{ tipo: "EFECTIVO", importe: 2_300_000 }, { tipo: "CREDITO", importe: 12_000_000, banco: "Banco Provincia", cobrado: false }],
  });

  // LA VENTA QUE MUESTRA K12: el cliente entrega su Logan y el usado queda a nombre de Héctor,
  // que financió la EcoSport. Ese usado va a cuenta de su capital: se le devuelve menos plata.
  await vender({
    dominio: "AD789GH", apellido: "Peralta", precio: 24_200_000, dias: 3,
    gastosVenta: [{ concepto: "Gestoría de transferencia", importe: 880_000 }],
    usado: { dominio: "AN789AB", marca: "Renault", modelo: "Logan", anio: 2015, km: 131_000, valor: 9_800_000, aNombreDe: "HECTOR" },
    pagos: [],
  });

  // Consignación: la ganancia es 100 % del salón y al dueño se le paga lo pactado.
  await vender({
    dominio: "AL123WX", apellido: "Varela", precio: 12_600_000, dias: 8,
    pagos: [{ tipo: "EFECTIVO", importe: 3_600_000 }],
  });

  // Venta de un auto de Silvana, cobrada toda por transferencia.
  await vender({
    dominio: "AE012IJ", apellido: "Ibáñez", precio: 25_800_000, dias: 58,
    gastosVenta: [{ concepto: "Gestoría de transferencia", importe: 910_000 }],
    pagos: [],
  });

  // Vendida pero todavía no entregada: queda en "Entregas" con fecha programada.
  const opPorEntregar = await vender({
    dominio: "AM456YZ", apellido: "Moreno", precio: 23_900_000, dias: 6,
    pagos: [],
    entregar: false,
  });
  await ventas.programarEntrega(U, opPorEntregar, diasAtras(-3), "SALÓN");

  // Operación abierta con seña: el auto queda reservado.
  const opAbierta = await ventas.crearOperacion(U, {
    contactoId: idContacto["Sosa"],
    vehiculoId: idAuto["AG678MN"],
    precioVenta: 27_900_000,
    observaciones: "Espera la aprobación del crédito",
  });
  await ventas.agregarPago(U, opAbierta, {
    tipo: "SENIA", importe: 800_000, fecha: iso(diasAtras(5)), medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true,
  });
  fechasOperacion.push({ id: opAbierta, dias: 5 });

  // Operación caída con la seña retenida: pasa, y el sistema lo contempla.
  const opCaida = await ventas.crearOperacion(U, {
    contactoId: idContacto["Castro"],
    vehiculoId: idAuto["AI234QR"],
    precioVenta: 44_200_000,
    observaciones: null,
  });
  await ventas.agregarPago(U, opCaida, {
    tipo: "SENIA", importe: 1_000_000, fecha: iso(diasAtras(34)), medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true,
  });
  await ventas.caerOperacion(U, opCaida, "No salió el crédito", "RETENER", "EFECTIVO");
  fechasOperacion.push({ id: opCaida, dias: 34 });

  // El banco acredita el crédito de la venta de Laura.
  const pagoCredito = await db.query.pagosOperacion.findFirst({
    where: and(eq(s.pagosOperacion.operacionId, opCredito), eq(s.pagosOperacion.tipo, "CREDITO")),
  });
  if (pagoCredito && pagoCredito.estado === "PENDIENTE") await ventas.cobrarPagoPendiente(U, opCredito, pagoCredito.id, "BANCO");

  // ---------- Gastos del salón y sueldos ----------
  await caja.crearMovimiento(U, { categoria: "GASTO_SALON", sentido: null, medio: "BANCO", importe: 2_400_000, concepto: "Alquiler del salón", fecha: diasAtras(35), participeId: null });
  await caja.crearMovimiento(U, { categoria: "GASTO_SALON", sentido: null, medio: "BANCO", importe: 2_400_000, concepto: "Alquiler del salón", fecha: diasAtras(5), participeId: null });
  await caja.crearMovimiento(U, { categoria: "GASTO_SALON", sentido: null, medio: "EFECTIVO", importe: 380_000, concepto: "Publicidad en redes", fecha: diasAtras(12), participeId: null });
  for (const d of [95, 65, 35, 5]) {
    await caja.crearMovimiento(U, {
      categoria: "SUELDO", sentido: null, medio: "BANCO", importe: 1_650_000,
      concepto: `Sueldo de ${empleada.nombre}`, fecha: diasAtras(d), participeId: null, personaId: empleada.id,
    });
  }

  // ---------- Pagar parte de lo que se les debe a los inversores ----------
  // Se pagan las dos más viejas y el resto queda pendiente, para que "Cuentas pendientes" tenga contenido.
  const pendientes = await db
    .select({ id: s.distribuciones.id, participeId: s.distribuciones.participeId })
    .from(s.distribuciones)
    .where(eq(s.distribuciones.estado, "PENDIENTE"))
    .orderBy(s.distribuciones.id);
  const deInversores = [];
  for (const d of pendientes) {
    const p = await db.query.participes.findFirst({ where: eq(s.participes.id, d.participeId) });
    if (p?.tipo === "INVERSOR") deInversores.push(d.id);
  }
  for (const id of deInversores.slice(0, 4)) await caja.pagarDistribucion(U, id, "BANCO");

  // ---------- Fechas ----------
  // Las operaciones se crearon todas hoy. Se corren hacia atrás, junto con los movimientos de
  // caja que generaron, para que Reportes muestre cuatro meses en vez de un solo día.
  console.log(SALIDA.gris("  Acomodando las fechas…"));

  // `habilitarVenta` marca la fecha de disponible con la de hoy, así que todos los autos
  // aparecerían con 0 días en stock. Se la corre a dos días después del ingreso, que es lo que
  // tarda en la realidad entre que entra y queda publicado.
  await db.execute(sql`update ${s.vehiculos}
                          set fecha_disponible = fecha_ingreso + interval '2 days'
                        where fecha_disponible is not null`);
  for (const { id, dias } of fechasOperacion) {
    const preventa = iso(diasAtras(dias));
    const cierre = iso(diasAtras(Math.max(0, dias - 1)));
    await db.update(s.operaciones).set({ fechaPreventa: preventa }).where(eq(s.operaciones.id, id));
    await db.execute(sql`update ${s.operaciones} set fecha_cierre = ${cierre}
                          where id = ${id} and fecha_cierre is not null`);
    const pagos = await db.select().from(s.pagosOperacion).where(eq(s.pagosOperacion.operacionId, id));
    const movs = pagos.map((p) => p.movimientoId).filter((x): x is number => x !== null);
    const liqs = await db.select().from(s.liquidaciones).where(eq(s.liquidaciones.operacionId, id));
    if (liqs.length) {
      const dist = await db.select().from(s.distribuciones).where(inArray(s.distribuciones.liquidacionId, liqs.map((l) => l.id)));
      movs.push(...dist.map((d) => d.movimientoId).filter((x): x is number => x !== null));
    }
    if (movs.length) {
      await db.update(s.movimientosCaja).set({ fecha: diasAtras(Math.max(0, dias - 1)) }).where(inArray(s.movimientosCaja.id, movs));
    }
  }

  // ---------- Verificación ----------
  // La misma identidad contable con la que se controla producción. Si la demo no cuadra, el
  // problema está en este script o en una regla del dominio, y conviene enterarse ahora y no
  // delante de un cliente.
  const [chequeo] = await db
    .select({
      caja: sql<string>`(select coalesce(sum(case when sentido='INGRESO' then importe else -importe end),0)
                           from ${s.movimientosCaja} where not anulado)`,
      gananciaSalon: sql<string>`(select coalesce(sum(parte_salon),0) from ${s.liquidaciones})`,
      gastosSalon: sql<string>`(select coalesce(sum(importe),0) from ${s.movimientosCaja}
                                  where not anulado and sentido='EGRESO'
                                    and categoria in ('GASTO_SALON','GASTO_EXTRAORDINARIO','SUELDO','RETIRO_SOCIO'))`,
      aportes: sql<string>`(select coalesce(sum(importe),0) from ${s.movimientosCaja}
                              where not anulado and categoria in ('APORTE','INGRESO_EXTRAORDINARIO'))`,
      aPagar: sql<string>`(select coalesce(sum(saldo),0) from ${s.cuentasPendientes}
                             where estado='ABIERTA' and tipo='A_PAGAR')`,
      aCobrar: sql<string>`(select coalesce(sum(saldo),0) from ${s.cuentasPendientes}
                              where estado='ABIERTA' and tipo='A_COBRAR')`,
      pendienteInversores: sql<string>`(select coalesce(sum(d.importe),0) from ${s.distribuciones} d
                                          join ${s.participes} p on p.id = d.participe_id
                                          where d.estado='PENDIENTE' and p.tipo='INVERSOR')`,
      enStock: sql<string>`(select coalesce(sum(valor_compra_ars),0) from ${s.vehiculos}
                              where estado in ('POR_INGRESAR','DISPONIBLE','RESERVADO')
                                and tipo_ingreso <> 'CONSIGNACION' and participe_id =
                                    (select id from ${s.participes} where tipo='SALON'))`,
      // Los gastos de un auto que todavía no se vendió ya salieron de la caja, pero su costo
      // no llegó a ninguna liquidación: queda invertido en el auto, como el valor de compra.
      gastosEnStock: sql<string>`(select coalesce(sum(g.importe),0) from ${s.gastos} g
                                    join ${s.vehiculos} v on v.id = g.vehiculo_id
                                    where v.estado in ('POR_INGRESAR','DISPONIBLE','RESERVADO'))`,
      // Una seña de una venta que no cerró está en la caja pero no es ganancia de nadie:
      // o se devuelve, o se retiene, o se imputa al precio cuando la venta cierre.
      seniasSinCerrar: sql<string>`(select coalesce(sum(p.importe),0)
                                      from ${s.pagosOperacion} p
                                      join ${s.operaciones} o on o.id = p.operacion_id
                                      where p.tipo = 'SENIA' and p.estado in ('COBRADO','RETENIDA')
                                        and o.estado not in ('CERRADA','ENTREGADA'))`,
    })
    .from(sql`(select 1) as x`);

  // De dónde sale la plata que hay en la caja, término por término. Si esto no da cero, o el
  // script está generando algo mal o cambió una regla del dominio.
  const n = (v: string) => Number(v);
  const esperada =
    n(chequeo.aportes) +              // lo que pusieron los socios
    n(chequeo.gananciaSalon) -        // lo que el salón ganó en las ventas cerradas
    n(chequeo.gastosSalon) -          // alquiler, sueldos, publicidad
    n(chequeo.enStock) -              // plata inmovilizada en autos propios sin vender
    n(chequeo.gastosEnStock) +        // y lo gastado en poner a punto esos autos
    n(chequeo.aPagar) +               // deudas todavía no pagadas: la plata sigue en la caja
    n(chequeo.pendienteInversores) +  // capital y ganancias de los inversores sin pagar
    n(chequeo.seniasSinCerrar) -      // señas de ventas que no cerraron
    n(chequeo.aCobrar);               // ventas ya cerradas cuya plata todavía no entró
  const descuadre = Math.round((n(chequeo.caja) - esperada) * 100) / 100;

  // ---------- Resumen ----------
  const [r] = await db
    .select({
      caja: sql<string>`(select coalesce(sum(case when sentido='INGRESO' then importe else -importe end),0)
                           from ${s.movimientosCaja} where not anulado)`,
      autos: sql<number>`(select count(*)::int from ${s.vehiculos})`,
      disponibles: sql<number>`(select count(*)::int from ${s.vehiculos} where estado='DISPONIBLE')`,
      operaciones: sql<number>`(select count(*)::int from ${s.operaciones})`,
      contactos: sql<number>`(select count(*)::int from ${s.contactos})`,
      movs: sql<number>`(select count(*)::int from ${s.movimientosCaja} where not anulado)`,
    })
    .from(sql`(select 1) as x`);

  const plata = (v: string | number) => `$ ${Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  console.log(`
${SALIDA.verde("  Datos de demostración cargados.")}

  Base            ${process.env.DATABASE_URL ? "DATABASE_URL (la que indicaste)" : (process.env.PGLITE_DIR ?? DIRECTORIO_DEMO)}
  Entrar con      ${SALIDA.negrita(EMAIL_DEMO)} / ${SALIDA.negrita(PASSWORD_DEMO)}

  Contactos       ${r.contactos}
  Autos           ${r.autos} (${r.disponibles} disponibles)
  Operaciones     ${r.operaciones}
  Movimientos     ${r.movs}
  Caja            ${plata(r.caja)}

  Descuadre       ${descuadre === 0 ? SALIDA.verde("$ 0,00 · los libros cierran") : SALIDA.rojo(plata(descuadre) + " · REVISAR")}

  ${SALIDA.gris("Todo es inventado. Ningún dato sale de un cliente real.")}
`);

  await db.$client.close?.();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
