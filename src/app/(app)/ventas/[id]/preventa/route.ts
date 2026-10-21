import { requerirUsuario } from "@/lib/auth";
import { generarPreventa } from "@/server/preventa-pdf";

/** Preventa en PDF para darle al cliente (se abre en el navegador; desde ahí se imprime o descarga). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requerirUsuario();
  const r = await generarPreventa(Number((await params).id), u.nombre);
  if (!r) return new Response("La operación no existe", { status: 404 });
  return new Response(Buffer.from(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
