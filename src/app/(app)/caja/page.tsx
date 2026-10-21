import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { gananciasPendientes, movimientos } from "@/server/caja";
import { datosFormulario } from "@/server/vehiculos";
import { listarPersonas } from "@/server/configuracion";
import { fecha, hoyIso } from "@/lib/formato";
import { ETIQUETA_CATEGORIA, type Medio } from "@/domain/caja";
import { IlustracionCaja, Vacio } from "@/components/ilustraciones";
import { NavCaja } from "./nav";
import { FormAnular, FormMovimiento, FormPagarGanancia } from "./formularios";

export const metadata = { title: "Caja · Colombia Automotores" };

type Busqueda = { desde?: string; hasta?: string; medio?: string; categoria?: string; q?: string };

export default async function CajaPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const hoy = hoyIso();
  const desde = sp.desde ?? `${hoy.slice(0, 8)}01`;
  const hasta = sp.hasta ?? hoy;
  const [{ m }, mov, pendientes, { participes }, personas] = await Promise.all([
    vistaMoneda(),
    movimientos({ desde, hasta, medio: sp.medio as Medio | undefined, categoria: sp.categoria, q: sp.q }),
    gananciasPendientes(),
    datosFormulario(),
    listarPersonas(true),
  ]);
  const socios = personas.filter((p) => p.rol === "SOCIO");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold">Caja</h1>
          <NavCaja actual="/caja" />
          <p className="max-w-2xl text-suave">
            Solo la plata líquida: efectivo y banco. Lo invertido en autos y lo que hay por cobrar está en <Link href="/patrimonio">Patrimonio</Link>.
          </p>
        </div>
        <IlustracionCaja className="hidden h-24 w-auto sm:block" />
      </header>

      <section aria-label="Saldos" className="grid gap-4 sm:grid-cols-3">
        {[
          { t: "Efectivo", v: mov.saldos.efectivo },
          { t: "Banco", v: mov.saldos.banco },
          { t: "Total líquido", v: mov.saldos.total },
        ].map((x) => (
          <div key={x.t} className="tarjeta flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-apagado">{x.t}</span>
            <span className={`num text-3xl ${x.v < 0 ? "text-aviso-texto" : ""}`}>{m(x.v)}</span>
          </div>
        ))}
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
            <span className={`num ${g.d.importe < 0 ? "text-aviso-texto" : ""}`}>{m(g.d.importe)}</span>
            <div className="w-full">
              <FormPagarGanancia id={g.d.id} importe={g.d.importe} etiqueta={g.participe.tipo === "INVERSOR" ? "Pagar" : "Retirar"} socios={g.participe.tipo === "SALON" ? socios : undefined} />
            </div>
          </div>
        ))}
      </section>

      <details className="tarjeta">
        <summary className="cursor-pointer text-lg font-semibold">+ Registrar movimiento</summary>
        <p className="mb-3 mt-1 text-sm text-apagado">
          Cobros de ventas, pagos de autos y gastos de cada auto se registran solos desde Ventas y Stock. Los sueldos y retiros quedan a nombre de una persona
          (se cargan en Configuración → Personas).
        </p>
        <FormMovimiento participes={participes} personas={personas} />
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
            Ingresos <b className="num text-ok-texto">{m(mov.ingresos)}</b>
          </span>
          <span>
            Egresos <b className="num text-aviso-texto">{m(mov.egresos)}</b>
          </span>
          <span>
            Neto del período <b className="num">{m(mov.ingresos - mov.egresos)}</b>
          </span>
        </div>
        <div className="overflow-x-auto">
          {mov.movimientos.length === 0 ? (
            <Vacio>No hay movimientos en este período.</Vacio>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Persona</th>
                  <th>Medio</th>
                  <th className="text-right">Importe</th>
                  <th>Cargó</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mov.movimientos.map(({ m: x, usuario, manual }) => (
                  <tr key={x.id} className={x.anulado ? "text-apagado line-through" : ""}>
                    <td className="num">{fecha(x.fecha)}</td>
                    <td>{ETIQUETA_CATEGORIA[x.categoria]}</td>
                    <td className="max-w-md whitespace-normal">
                      {x.operacionId ? <Link href={`/ventas/${x.operacionId}`}>{x.concepto}</Link> : x.vehiculoId ? <Link href={`/stock/${x.vehiculoId}`}>{x.concepto}</Link> : x.concepto}
                      {x.anulado && x.motivoAnulacion && <span className="block text-xs no-underline">Anulado: {x.motivoAnulacion}</span>}
                    </td>
                    <td>{personas.find((p) => p.id === x.personaId)?.nombre ?? ""}</td>
                    <td>{x.medio === "EFECTIVO" ? "Efectivo" : "Banco"}</td>
                    <td className={`num text-right ${x.sentido === "INGRESO" ? "text-ok-texto" : "text-aviso-texto"}`}>
                      {x.sentido === "INGRESO" ? "+ " : "− "}
                      {m(x.importe)}
                    </td>
                    <td>{usuario}</td>
                    <td>{manual && !x.anulado && <FormAnular id={x.id} />}</td>
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
