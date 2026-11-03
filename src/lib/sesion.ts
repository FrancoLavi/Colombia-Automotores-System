// Firma y verificación del token de sesión (compatible con middleware/edge). Reglas de duración: T4 en docs/MVP.md.
import { SignJWT, jwtVerify } from "jose";
import { ahoraS, estadoSesion, INACTIVIDAD_S, vencimientoSesion } from "@/domain/seguridad";

export const COOKIE_SESION = "sesion";
/** La cookie dura lo mismo que la inactividad permitida; se renueva con el token. */
export const DURACION_SESION_S = INACTIVIDAD_S;

export interface DatosSesion {
  uid: number;
  rol: "ADMIN" | "INVERSOR";
  /** Versión de sesión del usuario al ingresar: si cambia (nueva contraseña, "cerrar en todos"), la sesión deja de valer. */
  v: number;
  /** Momento del ingreso (segundos), para el tope absoluto de 7 días. */
  ini: number;
}

export interface SesionVerificada extends DatosSesion {
  renovar: boolean;
}

function clave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET no configurado (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function firmarSesion(datos: DatosSesion): Promise<string> {
  const ahora = ahoraS();
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(ahora)
    .setExpirationTime(vencimientoSesion(datos.ini, ahora))
    .sign(clave());
}

export async function verificarSesion(token: string | undefined): Promise<SesionVerificada | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    const iat = Number(payload.iat);
    // Tokens de antes de T4 no traen `ini` ni `v`: cuentan desde que se firmaron y con versión 0.
    const ini = Number(payload.ini ?? iat);
    const estado = estadoSesion({ ini, iat });
    if (estado === "VENCIDA") return null;
    return { uid: Number(payload.uid), rol: payload.rol as DatosSesion["rol"], v: Number(payload.v ?? 0), ini, renovar: estado === "RENOVAR" };
  } catch {
    return null;
  }
}

/** Opciones de la cookie de sesión (las mismas al crearla y al renovarla). */
export const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: DURACION_SESION_S,
  path: "/",
});
