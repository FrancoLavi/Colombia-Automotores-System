// Reglas de acceso (T4): duración de la sesión, bloqueo por intentos fallidos y recuperación de contraseña.

/** La sesión se cierra tras este tiempo sin usar el sistema. */
export const INACTIVIDAD_S = 8 * 60 * 60;
/** Tope absoluto: aunque se use todos los días, cada 7 días pide la contraseña de nuevo. */
export const TOPE_SESION_S = 7 * 24 * 60 * 60;
/** Cada cuánto se renueva el vencimiento por inactividad mientras se usa (para no reescribir la cookie en cada clic). */
export const RENOVAR_CADA_S = 10 * 60;

export const MAX_INTENTOS = 5;
export const BLOQUEO_MIN = 15;

export const VENCE_RECUPERACION_MIN = 30;
export const MAX_PEDIDOS_RECUPERACION_HORA = 3;
export const LARGO_MINIMO_PASSWORD = 8;

/** Segundos desde epoch, como en los JWT. */
export const ahoraS = (d: Date = new Date()) => Math.floor(d.getTime() / 1000);

/**
 * Estado de una sesión según cuándo se inició (`ini`) y cuándo se firmó por última vez (`iat`).
 * El vencimiento por inactividad lo controla la expiración del token; acá se mira el tope absoluto
 * y si conviene renovarlo.
 */
export function estadoSesion(s: { ini: number; iat: number }, ahora: number = ahoraS()): "VENCIDA" | "RENOVAR" | "VIGENTE" {
  if (ahora - s.ini >= TOPE_SESION_S) return "VENCIDA";
  if (ahora - s.iat >= INACTIVIDAD_S) return "VENCIDA";
  if (ahora - s.iat >= RENOVAR_CADA_S) return "RENOVAR";
  return "VIGENTE";
}

/** Vencimiento del token al (re)firmarlo: 8 h desde ahora, sin pasarse del tope absoluto. */
export function vencimientoSesion(ini: number, ahora: number = ahoraS()): number {
  return Math.min(ahora + INACTIVIDAD_S, ini + TOPE_SESION_S);
}

/** Tras un intento fallido: cuántos lleva y, si llegó al máximo, hasta cuándo queda bloqueado. */
export function registrarFallo(intentosPrevios: number, ahora: Date = new Date()): { intentos: number; bloqueadoHasta: Date | null } {
  const intentos = intentosPrevios + 1;
  return intentos >= MAX_INTENTOS ? { intentos: 0, bloqueadoHasta: new Date(ahora.getTime() + BLOQUEO_MIN * 60_000) } : { intentos, bloqueadoHasta: null };
}

/** Minutos que faltan para poder intentar de nuevo (0 = no está bloqueado). */
export function minutosBloqueado(bloqueadoHasta: Date | null, ahora: Date = new Date()): number {
  if (!bloqueadoHasta || bloqueadoHasta <= ahora) return 0;
  return Math.ceil((bloqueadoHasta.getTime() - ahora.getTime()) / 60_000);
}

/** Motivo por el que una contraseña nueva no sirve (null = sirve). */
export function problemaPassword(nueva: string, repetida?: string): string | null {
  if (nueva.length < LARGO_MINIMO_PASSWORD) return `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`;
  if (repetida !== undefined && nueva !== repetida) return "Las contraseñas nuevas no coinciden";
  return null;
}

/** Solo se vuelve a una ruta interna después de ingresar (evita redirigir a otro sitio). */
export function rutaDeVuelta(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.startsWith("/login")) return null;
  return v;
}
