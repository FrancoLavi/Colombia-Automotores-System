import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, firmarSesion, opcionesCookie, verificarSesion } from "@/lib/sesion";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = await verificarSesion(token);
  if (!sesion) {
    // Vuelve al login recordando adónde iba y, si había sesión, avisando que venció (T4).
    const url = new URL("/login", req.url);
    if (req.method === "GET") url.searchParams.set("volver", req.nextUrl.pathname + req.nextUrl.search);
    if (token) url.searchParams.set("motivo", "vencida");
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(COOKIE_SESION);
    return res;
  }
  const res = NextResponse.next();
  // Mientras se usa, la sesión se estira otras 8 h (sin pasar el tope de 7 días).
  if (sesion.renovar) {
    const { uid, rol, v, ini } = sesion;
    res.cookies.set(COOKIE_SESION, await firmarSesion({ uid, rol, v, ini }), opcionesCookie());
  }
  return res;
}

export const config = {
  // Todo menos el login (y recuperar contraseña) y los recursos estáticos.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
