import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { gananciasPendientes, movimientos, patrimonio } from "@/server/caja";
import { datosFormulario } from "@/server/vehiculos";
import { fecha, hoyIso, pesos } from "@/lib/formato";
import { ETIQUETA_CATEGORIA, type Medio } from "@/domain/caja";
import { NavCaja } from "./nav";
import { FormAnular, FormMovimiento, FormPagarGanancia } from "./formularios";

export const metadata = { title: "Caja · Colombia Automotores" };

type Busqueda = { desde?: string; hasta?: string; medio?: string; categoria?: string; q?: string };

function Linea({ color, etiqueta, valor, negativo }: { color?: string; etiqueta: string; valor: number; negativo?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-t border-linea py-2 text-sm">
      <span className="flex items-center gap-2">
        {color && <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
        {etiqueta}
      </span>
      <span className={`num ${negativo ? "text-aviso-texto" : ""}`}>
        {negativo ? "− " : ""}
        {pesos(valor)}
      </span>
    </div>
  );
}

export default async function CajaPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const hoy = hoyIso();
  const desde = sp.desde ?? `${hoy.slice(0, 8)}01`;
  const hasta = sp.hasta ?? hoy;
  const [mov, p, pendientes, { participes }] = await Promise.all([
    movimientos({ desde, hasta, medio: sp.medio as Medio | undefined, categoria: sp.categoria, q: sp.q }),
    patrimonio(),
    gananciasPendientes(),
    datosFormulario(),
  ]);
  const activos = Math.max(1, p.caja.total + p.stock + p.aCobrar);
  const pct = (n: number) => `${Math.max(0, (n / activos) * 100)}%`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Caja y patrimonio</h1>
        <NavCaja actual="/caja" />
        <p className="text-suave">La caja muestra solo plata líquida. El patrimonio suma además los autos al costo y lo que hay por cobrar.</p>
      </header>

      <section aria-label="Saldos" className="grid gap-4 sm:grid-cols-3">
        {[
          { t: "Efectivo", v: p.caja.efectivo },
          { t: "Banco", v: p.caja.banco },
          { t: "Caja total", v: p.caja.total },
        ].map((x) => (
          <div key={x.t} className="tarjeta flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-apagado">{x.t}</span>
            <span className={`num text-3xl ${x.v < 0 ? "text-aviso-texto" : ""}`}>{pesos(x.v)}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Patrimonio hoy</h2>
          <div className="flex h-4 overflow-hidden rounded-full bg-linea" role="img" aria-label="Composición del patrimonio">
            <div className="bg-[#c2410c]" style={{ width: pct(p.stock) }} />
            <div className="bg-ok" style={{ width: pct(Math.max(0, p.caja.total)) }} />
            <div className="bg-acento" style={{ width: pct(p.aCobrar) }} />
          </div>
          <div>
            <Linea color="#1e7a46" etiqueta="Caja (efectivo + banco)" valor={p.caja.total} />
            <Linea color="#c2410c" etiqueta={`${p.autosEnStock} ${p.autosEnStock === 1 ? "auto" : "autos"} en stock, al costo`} valor={p.stock} />
            <Linea color="#1f4fd1" etiqueta="A cobrar (créditos y saldos)" valor={p.aCobrar} />
            <Linea etiqueta="A pagar (deudas, consignantes, gastos)" valor={p.aPagar} negativo />
            <Linea etiqueta="Ganancias de inversores sin pagar" valor={p.aInversores} negativo />
            <div className="flex justify-between gap-3 border-t border-tinta pt-2 text-base font-semibold">
              <span>Patrimonio total</span>
              <span className="num">{pesos(p.total)}</span>
            </div>
          </div>
          {p.consignados > 0 && <p className="text-xs text-apagado">{p.consignados} autos en consignación no suman: no son del salón.</p>}
        </section>

        <section className="tarjeta flex flex-col">
          <h2 className="pb-2 text-lg font-semibold">Ganancias pendientes de pago</h2>
          {pendientes.length === 0 && <p className="text-sm text-apagado">No hay ganancias pendientes. Se generan al cerrar cada venta.</p>}
          {pendientes.map((g) => (
            <div key={g.d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linea py-2.5 text-sm">
              <span className="min-w-48">
                <b>{g.participe.nombre}</b> ·{" "}
                <Link href={`/ventas/${g.operacionId}`} className="num">
                  {g.numero}
                </Link>{" "}
                <span className="text-apagado">
                  {g.auto.marca} {g.auto.modelo} {g.auto.anio}
                </span>
              </span>
              <span className={`num ${g.d.importe < 0 ? "text-aviso-texto" : ""}`}>{pesos(g.d.importe)}</span>
              <div className="w-full">
                <FormPagarGanancia id={g.d.id} importe={g.d.importe} etiqueta={g.participe.tipo === "INVERSOR" ? "Pagar" : "Retirar"} />
              </div>
            </div>
          ))}
        </section>
      </div>

      <details className="tarjeta">
        <summary className="cursor-pointer text-lg font-semibold">+ Registrar movimiento</summary>
        <p className="mb-3 mt-1 text-sm text-apagado">
          Cobros de ventas, pagos de autos y gastos de cada auto se registran solos desde Ventas y Stock.
        </p>
        <FormMovimiento participes={participes} />
      </details>

      <section className="tarjeta flex flex-col gap-3 p-0">
        <form method="get" className="grid gap-3 p-4 pb-0 sm:grid-cols-2 lg:grid-cols-6">
          <label className="campo">
            Desde
            <input type="date" name="desde" defaultValue={desde} />
          </label>
          <label className="campo">
            Hasta
            <input type="date" name="hasta" defaultValue={hasta} />
          </label>
          <label className="campo">
            Medio
            <select name="medio" defaultValue={sp.medio ?? ""}>
              <option value="">Todos</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="BANCO">Banco</option>
            </select>
          </label>
          <label className="campo">
            Tipo
            <select name="categoria" defaultValue={sp.categoria ?? ""}>
              <option value="">Todos</option>
              {Object.entries(ETIQUETA_CATEGORIA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Buscar
            <input type="search" name="q" defaultValue={sp.q} placeholder="Concepto" />
          </label>
          <button className="btn-secundario self-end">Filtrar</button>
        </form>
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 text-sm">
          <span>
            Ingresos <b className="num text-ok-texto">{pesos(mov.ingresos)}</b>
          </span>
          <span>
            Egresos <b className="num text-aviso-texto">{pesos(mov.egresos)}</b>
          </span>
          <span>
            Neto del período <b className="num">{pesos(mov.ingresos - mov.egresos)}</b>
          </span>
        </div>
        <div className="overflow-x-auto">
          {mov.movimientos.length === 0 ? (
            <p className="p-4 text-suave">No hay movimientos en este período.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Medio</th>
                  <th className="text-right">Importe</th>
                  <th>Cargó</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mov.movimientos.map(({ m, usuario, manual }) => (
                  <tr key={m.id} className={m.anulado ? "text-apagado line-through" : ""}>
                    <td className="num">{fecha(m.fecha)}</td>
                    <td>{ETIQUETA_CATEGORIA[m.categoria]}</td>
                    <td className="max-w-md whitespace-normal">
                      {m.operacionId ? <Link href={`/ventas/${m.operacionId}`}>{m.concepto}</Link> : m.vehiculoId ? <Link href={`/stock/${m.vehiculoId}`}>{m.concepto}</Link> : m.concepto}
                      {m.anulado && m.motivoAnulacion && <span className="block text-xs no-underline">Anulado: {m.motivoAnulacion}</span>}
                    </td>
                    <td>{m.medio === "EFECTIVO" ? "Efectivo" : "Banco"}</td>
                    <td className={`num text-right ${m.sentido === "INGRESO" ? "text-ok-texto" : "text-aviso-texto"}`}>
                      {m.sentido === "INGRESO" ? "+ " : "− "}
                      {pesos(m.importe)}
                    </td>
                    <td>{usuario}</td>
                    <td>{manual && !m.anulado && <FormAnular id={m.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
