// Reglas del stock: estados, habilitación para la venta y alertas. Ver docs/MVP.md (V3–V5, HU-6.1).
import { diasEnStock, margenUsd } from "./negocio";

export type EstadoVehiculo = "POR_INGRESAR" | "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "ENTREGADO" | "RECHAZADO" | "BAJA";
export type Ubicacion = "SALON" | "CHAPISTA" | "ALISTAJE" | "MECANICO" | "OTRO";

export const ETIQUETA_ESTADO: Record<EstadoVehiculo, string> = {
  POR_INGRESAR: "Por ingresar",
  DISPONIBLE: "Disponible",
  RESERVADO: "Reservado",
  VENDIDO: "Vendido",
  ENTREGADO: "Entregado",
  RECHAZADO: "Rechazado",
  BAJA: "Baja",
};

export const ETIQUETA_UBICACION: Record<Ubicacion, string> = {
  SALON: "Salón",
  CHAPISTA: "Chapista",
  ALISTAJE: "Alistaje",
  MECANICO: "Mecánico",
  OTRO: "Otro",
};

/** Estados que cuentan como stock propio activo (para patrimonio y listados). */
export const ESTADOS_EN_STOCK: EstadoVehiculo[] = ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"];

/**
 * Cambios de estado que se hacen a mano desde la ficha.
 * RESERVADO / VENDIDO / ENTREGADO los maneja el módulo de ventas.
 */
const MANUALES: Partial<Record<EstadoVehiculo, EstadoVehiculo[]>> = {
  POR_INGRESAR: ["RECHAZADO", "BAJA"],
  DISPONIBLE: ["BAJA"],
  RECHAZADO: ["POR_INGRESAR"],
  BAJA: ["POR_INGRESAR"],
};

export function transicionesManuales(estado: EstadoVehiculo): EstadoVehiculo[] {
  return MANUALES[estado] ?? [];
}

export interface DocumentoEstado {
  nombre: string;
  obligatorio: boolean;
  estado: "PENDIENTE" | "RECIBIDO" | "NO_APLICA";
  fechaVencimiento: string | null;
}

/** V3: requisitos para pasar a DISPONIBLE. Devuelve los motivos que lo impiden (vacío = se puede). */
export function faltantesParaHabilitar(
  estado: EstadoVehiculo,
  documentos: DocumentoEstado[],
  peritaje: { resultado: "APTO" | "APTO_CON_OBS" | "NO_APTO" } | null,
): string[] {
  const motivos: string[] = [];
  if (estado !== "POR_INGRESAR") motivos.push(`El auto está ${ETIQUETA_ESTADO[estado].toLowerCase()}`);
  for (const d of documentos) {
    if (d.obligatorio && d.estado === "PENDIENTE") motivos.push(`Falta: ${d.nombre}`);
  }
  if (!peritaje) motivos.push("Falta el peritaje");
  else if (peritaje.resultado === "NO_APTO") motivos.push("El peritaje dio NO APTO");
  return motivos;
}

export type Severidad = "CRITICA" | "AVISO" | "INFO";
export interface AlertaVehiculo {
  tipo: "DIAS_STOCK" | "DOC_FALTANTE" | "VENCIMIENTO" | "MARGEN_USD" | "DATOS_INCOMPLETOS";
  severidad: Severidad;
  texto: string;
}

export interface ParametrosAlertas {
  diasAviso: number;
  diasCritico: number;
  diasAvisoVencimiento: number;
}

export const PARAMETROS_ALERTAS_DEFECTO: ParametrosAlertas = { diasAviso: 30, diasCritico: 60, diasAvisoVencimiento: 15 };

/** HU-6.1: alertas de un auto en stock. */
export function alertasVehiculo(
  v: {
    estado: EstadoVehiculo;
    fechaIngreso: string;
    fechaDisponible: string | null;
    costo: number;
    precio: number | null;
    tcIngreso: number;
  },
  documentos: DocumentoEstado[],
  tcHoy: number | null,
  p: ParametrosAlertas = PARAMETROS_ALERTAS_DEFECTO,
  hoy: Date = new Date(),
): AlertaVehiculo[] {
  if (!ESTADOS_EN_STOCK.includes(v.estado)) return [];
  const alertas: AlertaVehiculo[] = [];

  if (v.estado !== "POR_INGRESAR") {
    const dias = diasEnStock(v.fechaIngreso, v.fechaDisponible, hoy);
    if (dias >= p.diasCritico) alertas.push({ tipo: "DIAS_STOCK", severidad: "CRITICA", texto: `${dias} días en stock` });
    else if (dias >= p.diasAviso) alertas.push({ tipo: "DIAS_STOCK", severidad: "AVISO", texto: `${dias} días en stock` });
  }

  const faltan = documentos.filter((d) => d.obligatorio && d.estado === "PENDIENTE");
  if (faltan.length) {
    alertas.push({
      tipo: "DOC_FALTANTE",
      severidad: "AVISO",
      texto: faltan.length === 1 ? `Falta ${faltan[0].nombre}` : `Faltan ${faltan.length} papeles`,
    });
  }

  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  for (const d of documentos) {
    if (!d.fechaVencimiento || d.estado !== "RECIBIDO") continue;
    const dias = Math.round((new Date(`${d.fechaVencimiento}T00:00:00`).getTime() - h) / 86_400_000);
    if (dias < 0) alertas.push({ tipo: "VENCIMIENTO", severidad: "CRITICA", texto: `${d.nombre} vencida` });
    else if (dias <= p.diasAvisoVencimiento)
      alertas.push({ tipo: "VENCIMIENTO", severidad: "AVISO", texto: `${d.nombre} vence en ${dias} días` });
  }

  if (v.costo <= 0) alertas.push({ tipo: "DATOS_INCOMPLETOS", severidad: "AVISO", texto: "Costo sin cargar" });

  if (tcHoy && v.precio && v.costo > 0) {
    const m = margenUsd(v.precio, v.costo, v.tcIngreso, tcHoy);
    if (m.alerta) alertas.push({ tipo: "MARGEN_USD", severidad: "CRITICA", texto: `Margen USD ${(m.margen * 100).toFixed(1).replace(".", ",")} %` });
  }
  return alertas;
}
