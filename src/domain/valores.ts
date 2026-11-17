// T7 · Reglas de los valores recibidos: cheques y pagarés. Ver docs/MVP.md.
import { r2 } from "./negocio";

export type TipoValor = "CHEQUE" | "PAGARE";
export type EstadoValor = "EN_CARTERA" | "DEPOSITADO" | "ACREDITADO" | "ENDOSADO" | "RECHAZADO" | "INCOBRABLE";

export const ETIQUETA_VALOR: Record<TipoValor, string> = { CHEQUE: "Cheque", PAGARE: "Pagaré" };

export const ETIQUETA_ESTADO: Record<EstadoValor, string> = {
  EN_CARTERA: "En cartera",
  DEPOSITADO: "Depositado",
  ACREDITADO: "Acreditado",
  ENDOSADO: "Endosado",
  RECHAZADO: "Rechazado",
  INCOBRABLE: "Incobrable",
};

/**
 * Días para presentar el cheque al banco, contados **desde la fecha de pago** (no desde la
 * emisión, que es el error fácil). Es un parámetro y no un número fijo porque las fuentes que
 * consulté no coinciden del todo y la norma puede cambiar.
 */
export const DIAS_PRESENTACION = 30;
/** Cuántos días antes de que se venza el plazo conviene avisar que hay que depositarlo. */
export const DIAS_AVISO_VALOR = 5;

/**
 * Endosos que admite un cheque de pago diferido. Las fuentes se contradicen (la mayoría dice
 * dos, alguna dice uno), así que el sistema **avisa pero no bloquea**: equivocarse para el lado
 * de impedir algo legal es peor que mostrar un cartel de más.
 */
export const ENDOSOS_SUGERIDOS = 2;

/** Los estados en los que el valor todavía vale plata: su cuenta a cobrar sigue abierta. */
export const VIVOS: EstadoValor[] = ["EN_CARTERA", "DEPOSITADO", "RECHAZADO"];
/** Los que ya se resolvieron: la plata entró, se usó para pagar, o se perdió. */
export const CERRADOS: EstadoValor[] = ["ACREDITADO", "ENDOSADO", "INCOBRABLE"];

export const estaVivo = (estado: EstadoValor) => VIVOS.includes(estado);

export interface Valor {
  estado: EstadoValor;
  fechaPago: string;
  importe: number;
}

/** Días entre dos fechas ISO (positivo si `hasta` es posterior). */
const dias = (desde: string, hasta: string) =>
  Math.round((new Date(`${hasta}T00:00:00`).getTime() - new Date(`${desde}T00:00:00`).getTime()) / 86_400_000);

export type Alarma = "AL_DIA" | "POR_VENCER" | "VENCIDO" | "RECHAZADO";

/**
 * En qué situación está un valor hoy. `VENCIDO` no se guarda en la base: se deduce acá, porque
 * el sistema no corre tareas programadas y un estado guardado quedaría viejo al día siguiente.
 *
 * El plazo corre desde la fecha de pago y dura `DIAS_PRESENTACION` días. La alarma mira
 * cuántos días quedan de ese plazo, que es lo que le importa a tesorería: cuáles hay que llevar
 * al banco ya. Pasado el plazo queda VENCIDO: no deja de valer plata —se le sigue reclamando al
 * librador— pero ya no se cobra por ventanilla.
 */
export function alarmaValor(
  v: Pick<Valor, "estado" | "fechaPago">,
  hoyIso: string,
  diasPresentacion = DIAS_PRESENTACION,
): Alarma {
  if (v.estado === "RECHAZADO") return "RECHAZADO";
  if (!estaVivo(v.estado)) return "AL_DIA";
  const quedan = dias(hoyIso, v.fechaPago) + diasPresentacion;
  if (quedan < 0) return "VENCIDO";
  if (quedan <= DIAS_AVISO_VALOR) return "POR_VENCER";
  return "AL_DIA";
}

/** Último día para presentarlo al banco. */
export function vencimiento(fechaPago: string, diasPresentacion = DIAS_PRESENTACION): string {
  const d = new Date(`${fechaPago}T00:00:00`);
  d.setDate(d.getDate() + diasPresentacion);
  return d.toISOString().slice(0, 10);
}

/** Si ya se puede llevar al banco (llegó la fecha de pago y no se pasó el plazo). */
export function sePuedeDepositar(v: Pick<Valor, "estado" | "fechaPago">, hoyIso: string): boolean {
  if (v.estado !== "EN_CARTERA") return false;
  return dias(hoyIso, v.fechaPago) <= 0 && alarmaValor(v, hoyIso) !== "VENCIDO";
}

/** Qué se puede hacer con un valor según su estado. La pantalla muestra solo estos botones. */
export function accionesPosibles(estado: EstadoValor): EstadoValor[] {
  switch (estado) {
    case "EN_CARTERA":
      return ["DEPOSITADO", "ENDOSADO", "RECHAZADO", "INCOBRABLE"];
    case "DEPOSITADO":
      return ["ACREDITADO", "RECHAZADO"];
    // Rebotó: o se vuelve a intentar, o se endosa igual, o se da por perdido.
    case "RECHAZADO":
      return ["EN_CARTERA", "INCOBRABLE"];
    default:
      return [];
  }
}

/** Motivo por el que un cambio de estado no se puede hacer (null = se puede). */
export function problemaCambio(desde: EstadoValor, hacia: EstadoValor): string | null {
  if (desde === hacia) return `El valor ya está ${ETIQUETA_ESTADO[hacia].toLowerCase()}`;
  if (CERRADOS.includes(desde)) {
    return `Un valor ${ETIQUETA_ESTADO[desde].toLowerCase()} ya no se puede cambiar. Si fue un error, anulá el movimiento que lo cerró.`;
  }
  if (!accionesPosibles(desde).includes(hacia)) {
    return `No se puede pasar de ${ETIQUETA_ESTADO[desde].toLowerCase()} a ${ETIQUETA_ESTADO[hacia].toLowerCase()}`;
  }
  return null;
}

export interface ResumenCartera {
  enCartera: number;
  depositados: number;
  rechazados: number;
  vencidos: number;
  /** Lo que vale la cartera hoy: todo lo que todavía se puede cobrar. */
  total: number;
}

/** El total de la cartera, para el encabezado de Tesorería. */
export function resumenCartera(valores: Valor[], hoyIso: string): ResumenCartera {
  const suma = (f: (v: Valor) => boolean) => r2(valores.filter(f).reduce((a, v) => a + v.importe, 0));
  return {
    enCartera: suma((v) => v.estado === "EN_CARTERA"),
    depositados: suma((v) => v.estado === "DEPOSITADO"),
    rechazados: suma((v) => v.estado === "RECHAZADO"),
    vencidos: suma((v) => alarmaValor(v, hoyIso) === "VENCIDO"),
    total: suma((v) => estaVivo(v.estado)),
  };
}
