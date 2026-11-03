import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { Vacio } from "@/components/ilustraciones";
import { FormFiltros } from "@/components/filtros";
import { vistaMoneda } from "@/lib/moneda";
import { pedidosAbiertos } from "@/server/contactos";
import { marcasUsadas } from "@/server/vehiculos";
import { nombreContacto, fecha } from "@/lib/formato";
import { describirPedido } from "@/domain/contactos";
import { Telefono } from "../chips";
import { FilaPedido } from "../formularios";

export const metadata = { title: "Pedidos · Colombia Automotores" };

type Busqueda = { q?: string; marca?: string; stock?: string };
type Pedido = Awaited<ReturnType<typeof pedidosAbiertos>>[number];

/** Minúsculas y sin tildes, para que "gomez" encuentre a "Gómez". */
const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function coincide(p: Pedido, sp: Busqueda) {
  if (sp.marca && normalizar(p.marca ?? "") !== normalizar(sp.marca)) return false;
  if (sp.stock === "si" && !p.coincidencias.length) return false;
  if (sp.stock === "no" && p.coincidencias.length) return false;
  const q = sp.q?.trim();
  if (!q) return true;
  const digitos = q.replace(/\D/g, "");
  // Un teléfono se busca por sus números, se haya escrito con espacios o guiones o sin ellos.
  if (digitos.length >= 3 && (p.contacto.telefono ?? "").replace(/\D/g, "").includes(digitos)) return true;
  const texto = normalizar(`${describirPedido(p)} ${p.notas ?? ""} ${nombreContacto(p.contacto)} ${p.contacto.telefono ?? ""}`);
  return normalizar(q)
    .split(/\s+/)
    .every((palabra) => texto.includes(palabra));
}

export default async function PedidosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const { m } = await vistaMoneda();
  const [todos, marcasStock] = await Promise.all([pedidosAbiertos(), marcasUsadas()]);
  const pedidos = todos.filter((p) => coincide(p, sp));
  const conStock = pedidos.filter((p) => p.coincidencias.length);
  const filtrando = Boolean(sp.q || sp.marca || sp.stock);
  const marcas = [...new Set(todos.map((p) => p.marca).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contactos" className="text-sm font-semibold">
        ← Volver a contactos
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Lo que piden los clientes</h1>
        <p className="mt-1 text-suave">
          {filtrando ? `${pedidos.length} de ${todos.length}` : pedidos.length} pedidos abiertos · {conStock.length} con autos en stock que
          coinciden. Sirve para decidir qué tomar y a quién llamar.
        </p>
      </div>
      <FormFiltros plegable className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="campo lg:col-span-2">
          Buscar
          <input type="search" name="q" defaultValue={sp.q} placeholder="Auto, contacto, teléfono o nota" />
        </label>
        <label className="campo">
          Marca
          <select name="marca" defaultValue={sp.marca ?? ""}>
            <option value="">Todas</option>
            {marcas.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          En stock
          <select name="stock" defaultValue={sp.stock ?? ""}>
            <option value="">Todos</option>
            <option value="si">Con autos que coinciden</option>
            <option value="no">Sin autos que coincidan</option>
          </select>
        </label>
        <div className="flex items-end gap-2 lg:col-span-4">
          <button className="btn-secundario">Filtrar</button>
          {filtrando && (
            <Link href="/contactos/pedidos" className="btn text-sm text-acento">
              Limpiar
            </Link>
          )}
        </div>
      </FormFiltros>
      <section className="tarjeta overflow-x-auto p-0">
        {pedidos.length === 0 ? (
          filtrando ? (
            <p className="p-4 text-suave">No hay pedidos con estos filtros.</p>
          ) : (
            <Vacio>No hay pedidos abiertos. Se registran desde la ficha de cada contacto.</Vacio>
          )
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Busca</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Desde</th>
                <th>En stock que coinciden</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <FilaPedido key={p.id} contactoId={p.contacto.id} pedido={p} marcas={marcasStock}>
                  <td className="whitespace-normal">
                    <b>{describirPedido(p)}</b>
                    {p.notas && <div className="text-xs text-apagado">{p.notas}</div>}
                  </td>
                  <td>
                    <Link href={`/contactos/${p.contacto.id}`}>
                      {nombreContacto(p.contacto)}
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
                          <Link key={v.id} href={`/stock/${v.id}`} className="chip border border-borde bg-superficie text-tinta">
                            {v.marca} {v.modelo} {v.anio} · {m(v.precio)}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-apagado">—</span>
                    )}
                  </td>
                </FilaPedido>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
