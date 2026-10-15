import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// Archivos (fotos de peritaje, documentos). En producción: Supabase Storage (SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY). En desarrollo: disco local en ./.data/uploads.

const BUCKET = process.env.SUPABASE_BUCKET ?? "archivos";
const supabase = () =>
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? { url: process.env.SUPABASE_URL.replace(/\/$/, ""), key: process.env.SUPABASE_SERVICE_ROLE_KEY }
    : null;
const DIR_LOCAL = path.resolve(process.env.UPLOADS_DIR ?? "./.data/uploads");

function rutaLocal(clave: string) {
  const p = path.resolve(DIR_LOCAL, clave);
  if (!p.startsWith(DIR_LOCAL + path.sep)) throw new Error("Ruta inválida");
  return p;
}

export async function guardarArchivo(clave: string, datos: Buffer, tipo: string) {
  const sb = supabase();
  if (sb) {
    const r = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${clave}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sb.key}`, "Content-Type": tipo, "x-upsert": "true" },
      body: new Uint8Array(datos),
    });
    if (!r.ok) throw new Error(`No se pudo guardar el archivo (${r.status})`);
    return;
  }
  const p = rutaLocal(clave);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, datos);
}

export async function leerArchivo(clave: string): Promise<Buffer | null> {
  const sb = supabase();
  if (sb) {
    const r = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${clave}`, { headers: { Authorization: `Bearer ${sb.key}` } });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  }
  try {
    return await readFile(rutaLocal(clave));
  } catch {
    return null;
  }
}

export async function borrarArchivo(clave: string) {
  const sb = supabase();
  if (sb) {
    await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${clave}`, { method: "DELETE", headers: { Authorization: `Bearer ${sb.key}` } });
    return;
  }
  await unlink(rutaLocal(clave)).catch(() => undefined);
}
