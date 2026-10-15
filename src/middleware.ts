import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/sesion";

export async function middleware(req: NextRequest) {
  const sesion = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value);
  if (!sesion) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Todo menos el login y los recursos estáticos.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
