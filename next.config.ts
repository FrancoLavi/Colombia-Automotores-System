import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (base local de desarrollo) no debe empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Fotos de peritaje (ya comprimidas en el navegador) y planillas.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
