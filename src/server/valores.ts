import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import { auditar } from "@/lib/auditoria";
import { hoyIso } from "@/lib/formato";
import { r2 } from "@/domain/negocio";
import {
  alarmaValor,
  ENDOSOS_SUGERIDOS,
  ETIQUETA_ESTADO,
  ETIQUETA_VALOR,
  problemaCambio,
  resumenCartera,
  sePuedeDepositar,
  vencimiento,
  type EstadoValor,
  type TipoValor,
} from "@/domain/valores";
import { registrarPagoCuenta } from "./caja";
import { ErrorNegocio } from "./errores";

// T7 · Tesorería: cheques y pagarés recibidos.
//
// El importe NO vive acá: vive en la cuenta a cobrar que respalda al valor. Esta tabla guarda
// el papel. Gracias a eso el patrimonio, el balance del salón y Cuentas pendientes siguen
// funcionando sin tocar una línea, y es imposible contar el mismo peso dos veces.

const ENTIDAD = "valor";
type Valor = typeof s.valores.$inferSelect;

const etiqueta = (v: Pick<Valor, "tipo" | "numero" | "banco">) =>
  `${ETIQUETA_VALOR[v.tipo]}${v.numero ? ` N° ${v.numero}` : ""}${v.banco ? ` (${v.banco})` : ""}`;

async function cargar(t: Tx | typeof db, id: number): Promise<Valor> {
  const v = await t.query.valores.findFirst({ where: eq(s.valores.id, id) });
  if (!v) throw new ErrorNegocio("El valor no existe");
  return v;
}

/** Deja el valor en un estado nuevo, validando la transición contra el dominio. */
async function mover(t: Tx, v: Valor, hacia: EstadoValor, extra: Partial<Valor> = {}) {
  const problema = problemaCambio(v.estado, hacia);
  if (problema) throw new ErrorNegocio(problema);
  await t.update(s.valores).set({ estado: hacia, ...extra }).where(eq(s.valores.id, v.id));
}

// ---------- Consultas ----------

export interface FiltrosValores {
  estado?: EstadoValor;
  /** Solo los que todavía valen plata. */
  vivos?: boolean;
}

export async function listarValores(f: FiltrosValores = {}) {
  const cond = [];
  if (f.estado) cond.push(eq(s.valores.estado, f.estado));
  if (f.vivos) cond.push(inArray(s.valores.estado, ["EN_CARTERA", "DEPOSITADO", "RECHAZADO"]));
  const filas = await db
    .select({ v: s.valores, cuenta: s.cuentasPendientes, contacto: s.contactos.nombre })
    .from(s.valores)
    .leftJoin(s.cuentasPendientes, eq(s.cuentasPendientes.id, s.valores.cuentaPendienteId))
    .leftJoin(s.contactos, eq(s.contactos.id, s.valores.contactoId))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(s.valores.fechaPago, desc(s.valores.id));
  const hoy = hoyIso();
  return filas.map(({ v, cuenta, contacto }) => ({
    ...v,
    cuenta,
    deQuien: v.librador?.trim() || v.recibidoDe?.trim() || contacto || "—",
    alarma: alarmaValor(v, hoy),
    vence: vencimiento(v.fechaPago),
    depositable: sePuedeDepositar(v, hoy),
    /** Sin cuenta todavía: vino de una venta que no se cerró. No se puede cobrar aún. */
    sinCuenta: v.cuentaPendienteId === null,
  }));
}

export async function tesoreria() {
  const valores = await listarValores();
  const resumen = resumenCartera(valores, hoyIso());
  const aPagar = await db
    .select()
    .from(s.cuentasPendientes)
    .where(and(eq(s.cuentasPendientes.tipo, "A_PAGAR"), eq(s.cuentasPendientes.estado, "ABIERTA")))
    .orderBy(s.cuentasPendientes.vencimiento);
  return { valores, resumen, aPagar };
}

// ---------- Altas ----------

export interface DatosValor {
  tipo: TipoValor;
  numero: string | null;
  banco: string | null;
  librador: string | null;
  libradorCuit: string | null;
  importe: number;
  fechaEmision: string | null;
  fechaPago: string;
  recibidoDe: string | null;
  contactoId: number | null;
  notas: string | null;
}

function validar(d: DatosValor) {
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe debe ser mayor a cero");
  if (!d.fechaPago) throw new ErrorNegocio("Indicá la fecha de pago del cheque");
  if (d.fechaEmision && d.fechaEmision > d.fechaPago) {
    throw new ErrorNegocio("La fecha de pago no puede ser anterior a la de emisión");
  }
}

/**
 * Cheque recibido fuera de una venta (lo trae un cliente para saldar una cuenta, por ejemplo).
 * Crea en el acto su cuenta a cobrar: el papel ya está en el salón.
 */
export async function registrarValor(usuarioId: number, d: DatosValor): Promise<number> {
  validar(d);
  return db.transaction(async (t) => {
    const [cta] = await t
      .insert(s.cuentasPendientes)
      .values({
        tipo: "A_COBRAR",
        origen: "VALOR",
        contraparte: d.librador?.trim() || d.recibidoDe?.trim() || "Sin identificar",
        contactoId: d.contactoId,
        importe: d.importe,
        saldo: d.importe,
        vencimiento: d.fechaPago,
        notas: `${ETIQUETA_VALOR[d.tipo]}${d.numero ? ` N° ${d.numero}` : ""}`,
      })
      .returning();
    const [v] = await t.insert(s.valores).values({ ...d, cuentaPendienteId: cta.id, creadoPor: usuarioId }).returning();
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: v.id, accion: "CREAR", despues: v,
      descripcion: `${etiqueta(v)} recibido de ${v.librador ?? v.recibidoDe ?? "sin identificar"} · $ ${d.importe.toLocaleString("es-AR")} · paga el ${d.fechaPago}`,
    });
    return v.id;
  });
}

/** Cheque que entra como pago de una venta. La cuenta a cobrar nace al cerrar la venta. */
export async function registrarValorDeVenta(t: Tx, usuarioId: number, pagoOperacionId: number, operacionId: number, d: DatosValor) {
  validar(d);
  const [v] = await t.insert(s.valores).values({ ...d, operacionId, pagoOperacionId, creadoPor: usuarioId }).returning();
  await auditar(t, {
    usuarioId, entidad: ENTIDAD, entidadId: v.id, accion: "CREAR", despues: v,
    descripcion: `${etiqueta(v)} recibido en la venta · $ ${d.importe.toLocaleString("es-AR")} · paga el ${d.fechaPago}`,
  });
  return v.id;
}

// ---------- Cambios de estado ----------

export async function depositar(usuarioId: number, id: number) {
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    if (!sePuedeDepositar(v, hoyIso())) {
      const alarma = alarmaValor(v, hoyIso());
      throw new ErrorNegocio(
        alarma === "VENCIDO"
          ? `Se pasó el plazo para presentarlo (vencía el ${vencimiento(v.fechaPago)}). Habría que pedirle otro al librador.`
          : `Todavía no se puede depositar: la fecha de pago es el ${v.fechaPago}.`,
      );
    }
    await mover(t, v, "DEPOSITADO");
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO", descripcion: `${etiqueta(v)} depositado` });
  });
}

/**
 * El banco acreditó la plata: entra a la caja. Se cobra la cuenta a cobrar con la maquinaria
 * de siempre, así el movimiento, el comprobante y la auditoría salen iguales que cualquier cobro.
 */
export async function acreditar(usuarioId: number, id: number, medio: "EFECTIVO" | "BANCO"): Promise<number> {
  const v = await cargar(db, id);
  const problema = problemaCambio(v.estado, "ACREDITADO");
  if (problema) throw new ErrorNegocio(problema);
  if (!v.cuentaPendienteId) {
    throw new ErrorNegocio("La venta que trajo este cheque todavía no se cerró: se cobra cuando se cierre.");
  }
  const movimientoId = await registrarPagoCuenta(usuarioId, v.cuentaPendienteId, v.importe, medio);
  await db.transaction(async (t) => {
    await t.update(s.valores).set({ estado: "ACREDITADO" }).where(eq(s.valores.id, id));
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO",
      descripcion: `${etiqueta(v)} acreditado · $ ${v.importe.toLocaleString("es-AR")} a ${medio.toLowerCase()}`,
    });
  });
  return movimientoId;
}

/**
 * Endoso: se le paga a un tercero con este cheque. **No toca la caja**, y tiene que ser así:
 * no entró ni salió un peso. Cancela la cuenta a cobrar del cheque y la cuenta a pagar que salda.
 * El patrimonio no cambia, que es lo correcto: se pagó una deuda con un activo del mismo valor.
 */
export async function endosar(usuarioId: number, id: number, cuentaPagarId: number) {
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    const problema = problemaCambio(v.estado, "ENDOSADO");
    if (problema) throw new ErrorNegocio(problema);
    if (!v.cuentaPendienteId) throw new ErrorNegocio("La venta que trajo este cheque todavía no se cerró.");

    const deuda = await t.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, cuentaPagarId) });
    if (!deuda || deuda.tipo !== "A_PAGAR" || deuda.estado !== "ABIERTA") throw new ErrorNegocio("Esa deuda no está abierta");
    if (r2(v.importe) > r2(deuda.saldo)) {
      throw new ErrorNegocio(
        `El cheque es de $ ${v.importe.toLocaleString("es-AR")} y la deuda con ${deuda.contraparte} es de $ ${deuda.saldo.toLocaleString("es-AR")}. Un cheque se endosa entero: no se puede usar para pagar menos de lo que vale.`,
      );
    }

    const saldo = r2(deuda.saldo - v.importe);
    await t.update(s.cuentasPendientes).set({ saldo, estado: saldo === 0 ? "CANCELADA" : "ABIERTA" }).where(eq(s.cuentasPendientes.id, deuda.id));
    await t.update(s.cuentasPendientes).set({ saldo: 0, estado: "CANCELADA" }).where(eq(s.cuentasPendientes.id, v.cuentaPendienteId));
    await mover(t, v, "ENDOSADO", { endosadoA: deuda.contraparte, cuentaPagadaId: deuda.id, fechaEndoso: hoyIso() });
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO",
      descripcion: `${etiqueta(v)} endosado a ${deuda.contraparte} · $ ${v.importe.toLocaleString("es-AR")} · no pasa por la caja`,
    });
  });
}

export async function rechazar(usuarioId: number, id: number, motivo: string) {
  if (!motivo.trim()) throw new ErrorNegocio("Indicá por qué rebotó");
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    const endosado = v.estado === "ENDOSADO";
    const problema = problemaCambio(v.estado, "RECHAZADO");
    if (problema) throw new ErrorNegocio(problema);
    await mover(t, v, "RECHAZADO", { notas: [v.notas, `Rechazado: ${motivo.trim()}`].filter(Boolean).join(" · ") });
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO",
      descripcion: `${etiqueta(v)} rechazado (${motivo.trim()})${endosado ? " · revisar la deuda que había cancelado" : ""}`,
    });
  });
}

/** Un rechazado que se vuelve a intentar: el librador dice que ahora tiene fondos. */
export async function volverACartera(usuarioId: number, id: number) {
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    await mover(t, v, "EN_CARTERA");
    await auditar(t, { usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO", descripcion: `${etiqueta(v)} vuelve a cartera` });
  });
}

/**
 * Se da por perdido. **Recién acá impacta como pérdida:** se cancela la cuenta a cobrar sin que
 * entre plata, así que el patrimonio baja por el importe del cheque. Hasta este momento el
 * rechazado seguía contando como algo por cobrar, con su aviso en pantalla.
 */
export async function darPorIncobrable(usuarioId: number, id: number, motivo: string) {
  if (!motivo.trim()) throw new ErrorNegocio("Explicá por qué se da por perdido: queda en la auditoría");
  await db.transaction(async (t) => {
    const v = await cargar(t, id);
    const problema = problemaCambio(v.estado, "INCOBRABLE");
    if (problema) throw new ErrorNegocio(problema);
    if (v.cuentaPendienteId) {
      await t.update(s.cuentasPendientes).set({ saldo: 0, estado: "CANCELADA" }).where(eq(s.cuentasPendientes.id, v.cuentaPendienteId));
    }
    await mover(t, v, "INCOBRABLE", { notas: [v.notas, `Incobrable: ${motivo.trim()}`].filter(Boolean).join(" · ") });
    await auditar(t, {
      usuarioId, entidad: ENTIDAD, entidadId: id, accion: "CAMBIO_ESTADO",
      descripcion: `${etiqueta(v)} dado por incobrable · pérdida de $ ${v.importe.toLocaleString("es-AR")} (${motivo.trim()})`,
    });
  });
}

/** Cuántas veces se endosó un cheque, para el aviso del límite. */
export const avisoEndosos = (endosos: number) =>
  endosos >= ENDOSOS_SUGERIDOS
    ? `Este cheque ya tiene ${endosos} endosos. El límite habitual es ${ENDOSOS_SUGERIDOS}: confirmá con tu contador antes de endosarlo otra vez.`
    : null;

export { ETIQUETA_ESTADO };
