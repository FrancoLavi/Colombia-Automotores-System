import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { usuarioActual } from "@/lib/auth";
import { leerArchivo } from "@/lib/almacenamiento";

const TIPOS: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual();
  if (!u || u.rol !== "ADMIN") return new Response("No autorizado", { status: 401 });
  const id = Number((await params).id);
  const a = Number.isInteger(id) ? await db.query.archivos.findFirst({ where: eq(schema.archivos.id, id) }) : null;
  if (!a) return new Response("No encontrado", { status: 404 });
  const datos = await leerArchivo(a.url);
  if (!datos) return new Response("No encontrado", { status: 404 });
  const ext = a.url.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(datos), {
    headers: { "Content-Type": TIPOS[ext] ?? "application/octet-stream", "Cache-Control": "private, max-age=86400" },
  });
}
