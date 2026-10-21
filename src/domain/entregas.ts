// Entregas programadas: calendario y alarma previa. La alarma salta DIAS_ALARMA días antes.
import type { Severidad } from "./stock";

export const DIAS_ALARMA_ENTREGA = 3;

export interface PendientesEntrega {
  estadoOperacion: "PREVENTA" | "SENIADA" | "CERRADA" | "ENTREGADA" | "CAIDA";
  faltaCubrir: number;
  aCobrar: number;
  papelesFaltantes: number;
  estadoAuto: string;
}

/** Qué falta terminar antes de entregar el auto. */
export function pendientesParaEntregar(p: PendientesEntrega): string[] {
  const m: string[] = [];
  if (p.estadoOperacion === "PREVENTA" || p.estadoOperacion === "SENIADA") m.push("la venta no está cerrada");
  if (p.faltaCubrir > 0) m.push(`faltan cubrir $ ${p.faltaCubrir.toLocaleString("es-AR")}`);
  if (p.aCobrar > 0) m.push(`quedan $ ${p.aCobrar.toLocaleString("es-AR")} a cobrar`);
  if (p.papelesFaltantes > 0) m.push(p.papelesFaltantes === 1 ? "falta 1 papel" : `faltan ${p.papelesFaltantes} papeles`);
  if (p.estadoAuto === "POR_INGRESAR") m.push("el auto todavía está por ingresar");
  return m;
}

// Argentina no tiene horario de verano: siempre UTC−3. Así el servidor (que puede estar en UTC) arma bien los días.
const OFFSET_AR = -3 * 3_600_000;

/** Día calendario en Argentina, "AAAA-MM-DD". */
export function diaArgentina(d: Date): string {
  return new Date(d.getTime() + OFFSET_AR).toISOString().slice(0, 10);
}

/** Hora en Argentina, "HH:MM". */
export function horaArgentina(d: Date): string {
  return new Date(d.getTime() + OFFSET_AR).toISOString().slice(11, 16);
}

/** "2026-10-24" + "16:30" (hora argentina) → Date. */
export function desdeArgentina(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-03:00`);
}

/** Días (calendario, en Argentina) que faltan para la entrega. Negativo = atrasada. */
export function diasParaEntrega(programada: Date, hoy: Date = new Date()): number {
  return Math.round((Date.parse(diaArgentina(programada)) - Date.parse(diaArgentina(hoy))) / 86_400_000);
}

/** Alarma de entrega: dentro de los próximos DIAS_ALARMA días (o atrasada) y sin entregar. */
export function alarmaEntrega(
  programada: Date | null,
  pendientes: PendientesEntrega,
  hoy: Date = new Date(),
): { severidad: Severidad; dias: number; texto: string } | null {
  if (!programada || pendientes.estadoOperacion === "ENTREGADA" || pendientes.estadoOperacion === "CAIDA") return null;
  const dias = diasParaEntrega(programada, hoy);
  if (dias > DIAS_ALARMA_ENTREGA) return null;
  const falta = pendientesParaEntregar(pendientes);
  const cuando = dias < 0 ? `atrasada ${-dias} ${dias === -1 ? "día" : "días"}` : dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`;
  return {
    severidad: dias <= 0 || falta.length ? "CRITICA" : "AVISO",
    dias,
    texto: `Entrega ${cuando}${falta.length ? `: ${falta.join(", ")}` : " · todo listo"}`,
  };
}

/** Semanas de un mes para el calendario (lunes a domingo), con los días fuera del mes en null. */
export function semanasDelMes(anio: number, mes: number): (string | null)[][] {
  const primero = new Date(anio, mes - 1, 1);
  const diasMes = new Date(anio, mes, 0).getDate();
  const offset = (primero.getDay() + 6) % 7; // lunes = 0
  const celdas: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(`${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (celdas.length % 7) celdas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}
