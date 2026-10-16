import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { listarOperaciones } from "@/server/ventas";
import { fecha, hoyIso, pesos } from "@/lib/formato";
import { ChipOperacion } from "./chip";

export const metadata = { title: "Ventas · Colombia Automotores" };

const PESTANAS = [
  { clave: "ABIERTAS", titulo: "Abiertas", estados: ["PREVENTA", "SENIADA"] },
  { clave: "CERRADAS", titulo: "Cerradas sin entregar", estados: ["CERRADA"] },
  { clave: "ENTREGADAS", titulo: "Entregadas", estados: ["ENTREGADA"] },
  { clave: "CAIDAS", titulo: "Caídas", estados: ["CAIDA"] },
] as const;

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  await requerirUsuario();
  const { ver: pedido } = await searchParams;
  const ver = (PESTANAS.find((p) => p.clave === pedido)?.clave ?? "ABIERTAS") as (typeof PESTANAS)[number]["clave"];
  const { operaciones, conteo } = await listarOperaciones(ver);
  const hoy = hoyIso();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ventas</h1>
          <p className="mt-1 text-suave">Preventa → seña → cierre → entrega.</p>
        </div>
        <Link href="/ventas/nueva" className="btn-primario">
          + Nueva venta
        </Link>
      </header>

      <nav aria-label="Estados" className="flex flex-wrap gap-2.5">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/ventas?ver=${p.clave}`}
            className={`chip px-3.5 py-2 text-[13px] ${ver === p.clave ? "bg-tinta text-white" : "border border-borde bg-white text-tinta"}`}
          >
            {p.titulo} · {p.estados.reduce((a, e) => a + (conteo[e] ?? 0), 0)}
          </Link>
        ))}
      </nav>

      <section className="tarjeta overflow-x-auto p-0">
        {operaciones.length === 0 ? (
          <p className="p-6 text-suave">
            No hay operaciones acá. <Link href="/ventas/nueva">Armá una nueva venta</Link>.
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Auto</th>
                <th className="text-right">Precio</th>
                <th>Cubierto</th>
                <th>Estado</th>
                <th>Atención</th>
              </tr>
            </thead>
            <tbody>
              {operaciones.map((o) => {
                const pct = Math.min(100, Math.round((o.cobertura.cubierto / o.op.precioVenta) * 100));
                return (
                  <tr key={o.op.id}>
                    <td>
                      <Link href={`/ventas/${o.op.id}`} className="num font-medium">
                        {o.numero}
                      </Link>
                    </td>
                    <td className="num">{fecha(o.op.fechaPreventa)}</td>
                    <td>
                      <Link href={`/contactos/${o.contacto.id}`} className="text-tinta">
                        {o.contacto.nombre} {o.contacto.apellido}
                      </Link>
                    </td>
                    <td>
                      {o.auto.marca} {o.auto.modelo} {o.auto.anio} <span className="num text-apagado">{o.auto.dominio}</span>
                    </td>
                    <td className="num text-right">{pesos(o.op.precioVenta)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-linea" aria-hidden="true">
                          <div className={`h-2 rounded-full ${pct === 100 ? "bg-ok" : "bg-acento"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="num text-xs">{pct} %</span>
                      </div>
                    </td>
                    <td>
                      <ChipOperacion estado={o.op.estado} />
                    </td>
                    <td className="text-xs">
                      {o.venceSena && o.op.estado === "SENIADA" && o.venceSena <= hoy && <span className="chip bg-aviso-texto text-white">Seña vencida</span>}
                      {o.aCobrar > 0 && (o.op.estado === "CERRADA" || o.op.estado === "ENTREGADA") && (
                        <span className="chip bg-aviso-fondo text-aviso-texto">A cobrar {pesos(o.aCobrar)}</span>
                      )}
                      {o.op.estado === "CAIDA" && o.op.motivoCaida}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
