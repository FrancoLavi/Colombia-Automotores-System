// Firma y verificación del token de sesión (compatible con middleware/edge).
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESION = "sesion";
export const DURACION_SESION_S = 60 * 60 * 24 * 7;

export interface DatosSesion {
  uid: number;
  rol: "ADMIN" | "INVERSOR";
}

function clave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET no configurado (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function firmarSesion(datos: DatosSesion): Promise<string> {
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_S}s`)
    .sign(clave());
}

export async function verificarSesion(token: string | undefined): Promise<DatosSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    return { uid: Number(payload.uid), rol: payload.rol as DatosSesion["rol"] };
  } catch {
    return null;
  }
}
