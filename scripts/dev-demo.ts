// Levanta `next dev` contra la base de demostración en vez de la de desarrollo.
// Existe como script y no como variable de entorno en package.json porque en Windows
// `PGLITE_DIR=... next dev` no funciona ni en cmd ni en PowerShell.
import { spawn } from "node:child_process";

const dir = process.env.PGLITE_DIR ?? "./.data/demo";
console.log(`Base de demostración: ${dir}\n`);

const hijo = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PGLITE_DIR: dir, DATABASE_URL: "" },
});
hijo.on("exit", (code) => process.exit(code ?? 0));
