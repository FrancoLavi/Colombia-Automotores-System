import { requerirUsuario } from "@/lib/auth";
import { generarComprobante } from "@/server/comprobante-pdf";

/** Comprobante de cobro o pago en PDF (se abre en el navegador; desde ahí se imprime o se descarga). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requerirUsuario();
  const r = await generarComprobante(Number((await params).id), u.nombre);
  if (!r) return new Response("El movimiento no existe", { status: 404 });
  return new Response(Buffer.from(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
