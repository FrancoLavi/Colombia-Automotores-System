import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requerirUsuario } from "@/lib/auth";

export default async function InicioPage() {
  const u = await requerirUsuario();
  const porEstado = await db
    .select({ estado: schema.vehiculos.estado, n: sql<number>`count(*)::int` })
    .from(schema.vehiculos)
    .groupBy(schema.vehiculos.estado);
  const [{ contactos }] = await db.select({ contactos: sql<number>`count(*)::int` }).from(schema.contactos);
  const stock = porEstado.filter((e) => ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"].includes(e.estado)).reduce((s, e) => s + e.n, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Hola, {u.nombre}</h1>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="tarjeta">
          <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Autos en stock</div>
          <div className="num mt-2 text-3xl">{stock}</div>
        </div>
        <div className="tarjeta">
          <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Contactos</div>
          <div className="num mt-2 text-3xl">{contactos}</div>
        </div>
      </section>
      <p className="text-sm text-suave">El dashboard completo (objetivos, caja, patrimonio y alertas) se arma en el módulo 6.</p>
    </div>
  );
}
