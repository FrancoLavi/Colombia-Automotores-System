import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { hoyIso } from "@/lib/formato";
import { diasEnStock, r2 } from "@/domain/negocio";
import { objetivoUnidades, periodoDe, rotacion, rotacionPorModelo, ventasPorMes } from "@/domain/dashboard";
import { numeroOperacion } from "@/domain/ventas";
import type { Severidad } from "@/domain/stock";
import { patrimonio } from "./caja";
import { agenda } from "./contactos";
import { listarStock } from "./vehiculos";

export interface AlertaTablero {
  severidad: Severidad;
  texto: string;
  href: string;
}

const ORDEN: Record<Severidad, number> = { CRITICA: 0, AVISO: 1, INFO: 2 };

export async function tablero(hoy: Date = new Date()) {
  const hoyStr = hoyIso(hoy);
  const periodo = periodoDe(hoy);
  const inicioMes = `${periodo}-01`;
  const hace12 = hoyIso(new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1));

  const [cerradas, stock, p, ag, objetivo, tcs, senias, cuentasVencidas, ingresadosAntes] = await Promise.all([
    // Ventas cerradas de los últimos 12 meses con su liquidación.
    db
      .select({
        op: { id: s.operaciones.id, fechaCierre: s.operaciones.fechaCierre },
        l: { ganancia: s.liquidaciones.ganancia, parteSalon: s.liquidaciones.parteSalon, parteInversor: s.liquidaciones.parteInversor },
        v: { marca: s.vehiculos.marca, modelo: s.vehiculos.modelo, fechaIngreso: s.vehiculos.fechaIngreso, fechaDisponible: s.vehiculos.fechaDisponible },
      })
      .from(s.operaciones)
      .innerJoin(s.liquidaciones, eq(s.liquidaciones.operacionId, s.operaciones.id))
      .innerJoin(s.vehiculos, eq(s.vehiculos.id, s.operaciones.vehiculoId))
      .where(and(inArray(s.operaciones.estado, ["CERRADA", "ENTREGADA"]), gte(s.operaciones.fechaCierre, hace12))),
    listarStock({ estado: "ACTIVOS" }),
    patrimonio(),
    agenda(hoyStr),
    db.query.objetivos.findFirst({ where: eq(s.objetivos.periodo, periodo) }),
    db.select().from(s.tiposCambio).orderBy(desc(s.tiposCambio.fecha)).limit(40),
    db
      .select({ opId: s.operaciones.id, vence: s.pagosOperacion.vence, nombre: s.contactos.nombre, apellido: s.contactos.apellido })
      .from(s.pagosOperacion)
      .innerJoin(s.operaciones, eq(s.operaciones.id, s.pagosOperacion.operacionId))
      .innerJoin(s.contactos, eq(s.contactos.id, s.operaciones.contactoId))
      .where(and(eq(s.pagosOperacion.tipo, "SENIA"), eq(s.pagosOperacion.estado, "COBRADO"), eq(s.operaciones.estado, "SENIADA"), lte(s.pagosOperacion.vence, hoyIso(new Date(hoy.getTime() + 2 * 86_400_000))))),
    db
      .select()
      .from(s.cuentasPendientes)
      .where(and(eq(s.cuentasPendientes.estado, "ABIERTA"), lt(s.cuentasPendientes.vencimiento, hoyStr)))
      .orderBy(asc(s.cuentasPendientes.vencimiento)),
    // Stock al inicio del mes: autos ingresados antes del mes que siguen en stock o se vendieron este mes.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.vehiculos)
      .leftJoin(s.operaciones, and(eq(s.operaciones.vehiculoId, s.vehiculos.id), inArray(s.operaciones.estado, ["CERRADA", "ENTREGADA"])))
      .where(
        and(
          lt(s.vehiculos.fechaIngreso, inicioMes),
          sql`(${s.vehiculos.estado} in ('POR_INGRESAR','DISPONIBLE','RESERVADO') or ${s.operaciones.fechaCierre} >= ${inicioMes})`,
        ),
      ),
  ]);

  const delMes = cerradas.filter((c) => c.op.fechaCierre && c.op.fechaCierre >= inicioMes);
  const enStock = stock.vehiculos.filter((v) => ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"].includes(v.estado));
  // Si no hay historia (sistema recién arrancado), se usa el stock actual más lo vendido en el mes.
  const stockInicio = ingresadosAntes[0].n || enStock.length + delMes.length;
  const obj = objetivoUnidades(objetivo?.unidades, stockInicio);

  // Dólar: último cargado y variación contra el de hace ~30 días.
  const tc = tcs[0] ?? null;
  const hace30 = hoyIso(new Date(hoy.getTime() - 30 * 86_400_000));
  const tcAnterior = tcs.find((t) => t.fecha <= hace30) ?? tcs[tcs.length - 1] ?? null;
  const variacionDolar = tc && tcAnterior && tcAnterior.fecha !== tc.fecha ? (tc.valor - tcAnterior.valor) / tcAnterior.valor : null;

  const alertas: AlertaTablero[] = [];
  for (const v of enStock) {
    for (const a of v.alertas) {
      alertas.push({ severidad: a.severidad, texto: `${a.texto} · ${v.marca} ${v.modelo}${v.dominio ? ` ${v.dominio}` : ""}`, href: `/stock/${v.id}` });
    }
  }
  for (const x of senias) {
    alertas.push({
      severidad: x.vence! < hoyStr ? "CRITICA" : "AVISO",
      texto: `Seña de ${x.nombre} ${x.apellido ?? ""} ${x.vence! < hoyStr ? "vencida" : "vence pronto"} · ${numeroOperacion(x.opId)}`.replace(/\s+/g, " "),
      href: `/ventas/${x.opId}`,
    });
  }
  for (const c of cuentasVencidas) {
    alertas.push({ severidad: "AVISO", texto: `Cuenta vencida: ${c.tipo === "A_PAGAR" ? "le debemos a" : "nos debe"} ${c.contraparte} $ ${c.saldo.toLocaleString("es-AR")}`, href: "/caja/cuentas" });
  }
  if (variacionDolar != null && Math.abs(variacionDolar) >= 0.05) {
    alertas.push({ severidad: "INFO", texto: `El dólar ${variacionDolar > 0 ? "subió" : "bajó"} ${(Math.abs(variacionDolar) * 100).toFixed(1).replace(".", ",")} % en el último mes: revisá precios`, href: "/stock" });
  }
  alertas.sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);

  const ganancia = r2(delMes.reduce((a, c) => a + c.l.ganancia, 0));
  return {
    periodo,
    objetivo: { unidades: obj, ganancia: objetivo?.ganancia ?? null },
    vendidos: delMes.length,
    stockInicio,
    rotacion: rotacion(delMes.length, stockInicio),
    ganancia,
    gananciaSalon: r2(delMes.reduce((a, c) => a + c.l.parteSalon, 0)),
    gananciaInversores: r2(delMes.reduce((a, c) => a + c.l.parteInversor, 0)),
    patrimonio: p,
    stock: { total: enStock.length, porIngresar: enStock.filter((v) => v.estado === "POR_INGRESAR").length, diasPromedio: enStock.length ? Math.round(enStock.reduce((a, v) => a + v.dias, 0) / enStock.length) : 0 },
    tc,
    variacionDolar,
    alertas,
    agenda: ag,
    ventas12: ventasPorMes(cerradas.map((c) => c.op.fechaCierre!), hoy),
    rotacionModelos: rotacionPorModelo(
      cerradas.map((c) => ({ marca: c.v.marca, modelo: c.v.modelo, dias: diasEnStock(c.v.fechaIngreso, c.v.fechaDisponible, new Date(`${c.op.fechaCierre}T00:00:00`)) })),
    ).slice(0, 6),
  };
}
