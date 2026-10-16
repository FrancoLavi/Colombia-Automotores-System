import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { pedidosAbiertos } from "@/server/contactos";
import { fecha, pesos } from "@/lib/formato";
import { describirPedido } from "@/domain/contactos";
import { Telefono } from "../chips";

export const metadata = { title: "Pedidos · Colombia Automotores" };

export default async function PedidosPage() {
  await requerirUsuario();
  const pedidos = await pedidosAbiertos();
  const conStock = pedidos.filter((p) => p.coincidencias.length);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contactos" className="text-sm font-semibold">
        ← Volver a contactos
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Lo que piden los clientes</h1>
        <p className="mt-1 text-suave">
          {pedidos.length} pedidos abiertos · {conStock.length} con autos en stock que coinciden. Sirve para decidir qué tomar y a quién llamar.
        </p>
      </div>
      <section className="tarjeta overflow-x-auto p-0">
        {pedidos.length === 0 ? (
          <p className="p-6 text-suave">No hay pedidos abiertos. Se registran desde la ficha de cada contacto.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Busca</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Desde</th>
                <th>En stock que coinciden</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-normal">
                    <b>{describirPedido(p)}</b>
                    {p.notas && <div className="text-xs text-apagado">{p.notas}</div>}
                  </td>
                  <td>
                    <Link href={`/contactos/${p.contacto.id}`}>
                      {p.contacto.nombre} {p.contacto.apellido}
                    </Link>
                  </td>
                  <td>
                    <Telefono telefono={p.contacto.telefono} />
                  </td>
                  <td className="num">{fecha(p.creadoEn)}</td>
                  <td className="whitespace-normal">
                    {p.coincidencias.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {p.coincidencias.map((v) => (
                          <Link key={v.id} href={`/stock/${v.id}`} className="chip border border-borde bg-white text-tinta">
                            {v.marca} {v.modelo} {v.anio} · {pesos(v.precio)}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-apagado">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
