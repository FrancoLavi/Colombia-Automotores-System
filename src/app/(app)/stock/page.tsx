import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { listarStock } from "@/server/vehiculos";
import { fecha, numero, pesos, porcentaje } from "@/lib/formato";
import { ETIQUETA_ESTADO, ETIQUETA_UBICACION, type EstadoVehiculo, type Ubicacion } from "@/domain/stock";
import { ChipAlerta, ChipEstado } from "@/components/ui";
import { FormDolar } from "./form-dolar";

export const metadata = { title: "Stock · Colombia Automotores" };

type Busqueda = { q?: string; estado?: string; ubicacion?: string; marca?: string; dias?: string };

export default async function StockPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const { vehiculos, conteo, marcas, tc } = await listarStock({
    q: sp.q,
    estado: sp.estado,
    ubicacion: sp.ubicacion,
    marca: sp.marca,
    diasMin: sp.dias ? Number(sp.dias) : undefined,
  });
  const enStock = vehiculos.filter((v) => ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"].includes(v.estado));
  const invertido = enStock.reduce((s, v) => s + v.costo, 0);

  const chips: { estado: EstadoVehiculo; clase: string }[] = [
    { estado: "POR_INGRESAR", clase: "bg-aviso-fondo text-aviso-texto" },
    { estado: "DISPONIBLE", clase: "bg-ok-fondo text-ok-texto" },
    { estado: "RESERVADO", clase: "bg-info-fondo text-info-texto" },
    { estado: "VENDIDO", clase: "bg-neutro-fondo text-neutro-texto" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Stock</h1>
          <p className="mt-1 text-suave">
            {enStock.length} {enStock.length === 1 ? "auto" : "autos"} en stock · invertido {pesos(invertido)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/stock/importar" className="btn-secundario">
            Importar planilla
          </Link>
          <Link href="/stock/nuevo" className="btn-primario">
            + Ingresar auto
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2.5">
        {chips.map((c) => (
          <Link key={c.estado} href={`/stock?estado=${c.estado}`} className={`chip px-3.5 py-2 text-[13px] ${c.clase}`}>
            {ETIQUETA_ESTADO[c.estado]} · {conteo[c.estado] ?? 0}
          </Link>
        ))}
        <div className="ml-auto">
          <FormDolar actual={tc ? { fecha: fecha(tc.fecha), valor: tc.valor } : null} />
        </div>
      </div>

      <form className="tarjeta grid gap-3.5 p-4 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <label className="campo lg:col-span-2">
          Buscar
          <input type="search" name="q" defaultValue={sp.q} placeholder="Patente, marca o modelo" />
        </label>
        <label className="campo">
          Estado
          <select name="estado" defaultValue={sp.estado ?? "ACTIVOS"}>
            <option value="ACTIVOS">Activos</option>
            {(Object.keys(ETIQUETA_ESTADO) as EstadoVehiculo[]).map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </option>
            ))}
            <option value="TODOS">Todos</option>
          </select>
        </label>
        <label className="campo">
          Ubicación
          <select name="ubicacion" defaultValue={sp.ubicacion ?? ""}>
            <option value="">Todas</option>
            {(Object.keys(ETIQUETA_UBICACION) as Ubicacion[]).map((u) => (
              <option key={u} value={u}>
                {ETIQUETA_UBICACION[u]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Marca
          <select name="marca" defaultValue={sp.marca ?? ""}>
            <option value="">Todas</option>
            {marcas.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 items-end gap-2">
          <label className="campo min-w-0 flex-1">
            Más de N días
            <input type="number" name="dias" min={0} defaultValue={sp.dias} />
          </label>
          <button className="btn-secundario">Filtrar</button>
        </div>
      </form>

      <section className="tarjeta overflow-x-auto p-0">
        {vehiculos.length === 0 ? (
          <p className="p-6 text-suave">
            No hay autos con estos filtros. <Link href="/stock/nuevo">Ingresá el primero</Link> o <Link href="/stock/importar">importá la planilla</Link>.
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Patente</th>
                <th>Auto</th>
                <th>Año</th>
                <th className="text-right">Km</th>
                <th>Estado</th>
                <th>Ubicación</th>
                <th className="text-right">Días</th>
                <th className="text-right">Costo</th>
                <th className="text-right">Precio</th>
                <th className="text-right">Margen USD</th>
                <th>Alertas</th>
              </tr>
            </thead>
            <tbody>
              {vehiculos.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/stock/${v.id}`} className="num font-medium">
                      {v.dominio ?? "Sin patente"}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/stock/${v.id}`} className="text-tinta no-underline hover:underline">
                      {v.marca} {v.modelo} <span className="text-apagado">{v.version}</span>
                    </Link>
                  </td>
                  <td>{v.anio}</td>
                  <td className="num text-right">{numero(v.km)}</td>
                  <td>
                    <ChipEstado estado={v.estado} />
                  </td>
                  <td>{ETIQUETA_UBICACION[v.ubicacion]}</td>
                  <td className="num text-right">{v.estado === "POR_INGRESAR" ? "—" : v.dias}</td>
                  <td className="num text-right">{v.costo > 0 ? pesos(v.costo) : "—"}</td>
                  <td className="num text-right">{pesos(v.precio)}</td>
                  <td className={`num text-right ${v.margen != null && v.margen <= 0.1 ? "font-semibold text-aviso-texto" : ""}`}>
                    {v.margen != null ? porcentaje(v.margen) : "—"}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {v.alertas.map((a, i) => (
                        <ChipAlerta key={i} severidad={a.severidad}>
                          {a.texto}
                        </ChipAlerta>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-[13px] text-apagado">
        Margen USD: cuánto rinde el precio con el dólar blue de hoy contra lo invertido al dólar fijado en el ingreso. Por debajo del 10 % salta la alerta.
      </p>
    </div>
  );
}
