import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    // Los tests de integración usan una base PGlite en memoria por archivo.
    env: { PGLITE_DIR: "memory://", SESSION_SECRET: "x".repeat(32) },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
