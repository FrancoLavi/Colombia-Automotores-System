import type { NextConfig } from "next";

const desarrollo = process.env.NODE_ENV !== "production";

/**
 * Política de seguridad de contenido (CSP): la lista de lo que el navegador tiene permitido
 * cargar y ejecutar. Es la defensa de fondo contra XSS: si alguien logra inyectar un script
 * en una pantalla, la CSP evita que ese script se cargue o que se lleve datos a otro dominio.
 *
 * Va en modo **Report-Only**: el navegador NO bloquea nada, solo escribe en la consola qué
 * bloquearía. Cuando confirmemos que no rompe pantallas se pasa a `Content-Security-Policy`
 * (mismo texto, otro nombre de cabecera).
 *
 * La app no carga ni un recurso externo: las fuentes las baja `next/font` en el build y se
 * sirven desde este dominio, los PDF y las fotos salen de rutas propias, y SweetAlert viene
 * en el bundle. Por eso casi todo es 'self'.
 */
const csp = [
  "default-src 'self'",
  // Sin 'unsafe-inline' a propósito. Los scripts de hidratación que Next inserta en cada
  // página van a aparecer como violación en la consola: es lo esperado, y la lista que deja
  // es justo lo que hace falta para pasarles un nonce por pedido (queda para otro PR).
  // En desarrollo se permite 'unsafe-eval' porque el recargado en caliente lo necesita.
  `script-src 'self'${desarrollo ? " 'unsafe-eval'" : ""}`,
  // 'unsafe-inline' acá es permanente, no una deuda: los gráficos y las barras de progreso
  // calculan ancho y alto en el momento (src/components/grafico.tsx, reportes, patrimonio),
  // así que salen como atributo `style` en el HTML.
  "style-src 'self' 'unsafe-inline'",
  // data: lo usan los íconos SVG que Tailwind mete en los select y los checkbox.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // El navegador solo puede hablar con este mismo dominio: si entrara un script ajeno, no
  // tendría a dónde mandar los datos de la caja.
  "connect-src 'self'",
  // Nada de applets ni plugins.
  "object-src 'none'",
  // Que nadie pueda cambiar la base de las URL relativas con un <base> inyectado.
  "base-uri 'self'",
  // Los formularios solo se pueden enviar a este dominio (no se puede desviar un alta).
  "form-action 'self'",
  // La app no se puede meter dentro de un iframe de otro sitio (clickjacking).
  "frame-ancestors 'none'",
].join("; ");

const cabecerasSeguridad = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  // Dos años de HTTPS obligatorio: el navegador se niega a entrar por http aunque se lo pidan.
  // Es el mismo valor que Vercel ya manda por su cuenta en *.vercel.app; se declara acá para
  // no depender de ese default y para que siga valiendo si mañana se usa un dominio propio.
  // Bajarlo sería debilitar lo que ya hay. Los navegadores la ignoran sobre http: en local no molesta.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Lo mismo que frame-ancestors, para navegadores viejos que no entienden CSP.
  { key: "X-Frame-Options", value: "DENY" },
  // Que el navegador no adivine el tipo de un archivo: un .xlsx subido no se ejecuta como HTML.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Al salir a otro sitio no se filtra la ruta interna donde estaba el usuario.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara, micrófono ni ubicación: se niegan de entrada. Los <input type="file">
  // no se ven afectados (esto solo cubre getUserMedia y compañía).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // PGlite (base local de desarrollo) no debe empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Fotos de peritaje (ya comprimidas en el navegador) y planillas.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  // Todas las rutas, incluido /login y los estáticos (el middleware no los alcanza).
  headers: async () => [{ source: "/:path*", headers: cabecerasSeguridad }],
};

export default nextConfig;
