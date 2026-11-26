import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { Ayuda } from "@/components/ui";
import { FilaEnlace, FormFiltros } from "@/components/filtros";
import { Icono, InsigniaMovimiento } from "@/components/iconos-caja";
import { vistaMoneda } from "@/lib/moneda";
import { movimientos, opcionesDeAutos, patrimonio, pendientesPorPagar } from "@/server/caja";
import { CamposFiltroAuto, TdAuto, ThAuto } from "@/components/auto";
import { leerFiltroAuto } from "@/domain/autos";
import { listarPersonas } from "@/server/configuracion";
import { fecha, hoyIso } from "@/lib/formato";
import { ETIQUETA_CATEGORIA, type Medio } from "@/domain/caja";
import { IlustracionCaja, Vacio } from "@/components/ilustraciones";
import { NavCaja } from "./nav";
import { FormAnular, FormMovimiento } from "./formularios";

export const metadata = { title: "Caja · Colombia Automotores" };

type Busqueda = { desde?: string; hasta?: string; medio?: string; categoria?: string; q?: string; marca?: string; modelo?: string; patente?: string };

export default async function CajaPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const hoy = hoyIso();
  const desde = sp.desde ?? `${hoy.slice(0, 8)}01`;
  const hasta = sp.hasta ?? hoy;
  const filtroAuto = leerFiltroAuto(sp);
  const [{ m }, mov, pendientes, p, personas, opciones] = await Promise.all([
    vistaMoneda(),
    movimientos({ desde, hasta, medio: sp.medio as Medio | undefined, categoria: sp.categoria, q: sp.q, ...filtroAuto }),
    pendientesPorPagar(),
    patrimonio(),
    listarPersonas(true),
    opcionesDeAutos(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold">Caja</h1>
          <NavCaja actual="/caja" />
          <p className="max-w-2xl text-suave max-md:hidden">
            Solo la plata líquida: efectivo y banco. Lo invertido en autos y lo que hay por cobrar está en <Link href="/patrimonio">Patrimonio</Link>.
          </p>
        </div>
        <IlustracionCaja className="hidden h-24 w-auto sm:block" />
      </header>

      <section aria-label="Saldos" className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {[
          { t: "Efectivo", v: mov.saldos.efectivo, pie: null, href: "/caja/saldo/efectivo", icono: "efectivo" as const },
          { t: "Banco", v: mov.saldos.banco, pie: null, href: "/caja/saldo/banco", icono: "banco" as const },
          { t: "Total en caja", v: mov.saldos.total, pie: "Toda la plata que hay", href: "/caja/saldo/total", icono: "total" as const },
        ].map((x) => (
          <Link key={x.t} href={x.href} className="tarjeta flex flex-col gap-1.5 text-tinta no-underline transition-colors hover:border-tinta max-sm:flex-row max-sm:items-center max-sm:justify-between max-sm:py-3">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-apagado">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-info-fondo text-info-texto">
                <Icono nombre={x.icono} className="size-[18px]" />
              </span>
              {x.t}
            </span>
            <span className={`num text-xl sm:text-3xl ${x.v < 0 ? "text-aviso-texto" : ""}`}>{m(x.v)}</span>
            <span className="text-[13px] text-apagado max-sm:hidden">{x.pie ? `${x.pie} · ` : ""}Ver de dónde sale →</span>
          </Link>
        ))}
        {/* K11: de la plata que hay, la que es del salón. El resto se les debe a los inversores. */}
        <div className="tarjeta relative flex flex-col gap-1.5 border-tinta transition-colors hover:bg-fondo max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:justify-between max-sm:py-3">
          {/* Por encima del enlace que cubre la tarjeta, para que la ayuda se pueda abrir. */}
          <span className="relative z-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-apagado">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-ok-fondo text-ok-texto">
              <Icono nombre="salon" className="size-[18px]" />
            </span>
            Del salón
            <Ayuda>De la plata que hay en caja, lo que es del salón: se descuenta lo que se les debe a los inversores (su capital y su ganancia) y a los consignantes (lo pactado) por autos ya vendidos. Es solo plata líquida: en Patrimonio el salón suma además sus autos y lo que le deben, por eso ahí da otro número.</Ayuda>
          </span>
          <span className={`num text-xl sm:text-3xl ${p.cajaSalon < 0 ? "text-aviso-texto" : ""}`}>{m(p.cajaSalon)}</span>
          <Link href="/caja/saldo/salon" className="text-[13px] text-apagado no-underline after:absolute after:inset-0 max-sm:basis-full">
            {p.ajeno === 0 ? "Toda la caja es del salón" : `${m(p.ajeno)} son de inversores${p.deudaConsignantes ? " y consignantes" : ""}`} · Ver de dónde sale →
          </Link>
        </div>
      </section>
      {(mov.saldos.efectivo < 0 || mov.saldos.banco < 0) && (
        <p role="status" className="-mt-2 rounded-lg bg-aviso-fondo px-4 py-3 text-sm text-aviso-texto">
          <b>{mov.saldos.efectivo < 0 ? "El efectivo" : "El banco"} da negativo.</b> No puede salir más plata de la que hay (K13): desde ahora el sistema no lo
          deja pasar, así que viene de movimientos cargados antes. Casi siempre falta cargar la caja inicial (como ingreso extraordinario), algún cobro o la
          extracción del banco (pase Banco → Efectivo). Revisá los movimientos de abajo.
        </p>
      )}

      {/* Lo que se les debe a los inversores se gestiona en Cuentas pendientes, junto con el resto de las deudas. */}
      {pendientes.length > 0 && (
        <Link
          href="/caja/cuentas#inversores"
          className="tarjeta flex flex-wrap items-center justify-between gap-3 border-aviso-texto/40 bg-aviso-fondo/40 text-tinta no-underline hover:border-aviso-texto"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-aviso-fondo text-aviso-texto">
              <Icono nombre="inversor" />
            </span>
            <span>
              <b>
                {pendientes.length === 1 ? "Hay 1 pago pendiente" : `Hay ${pendientes.length} pagos pendientes`} a inversores por autos vendidos
              </b>
              <span className="block text-sm text-apagado">Esa plata está en la caja pero no es del salón. Se paga desde Cuentas pendientes.</span>
            </span>
          </span>
          <span className="num font-semibold text-aviso-texto">{m(p.deudaInversores)} →</span>
        </Link>
      )}

      <details className="tarjeta">
        <summary className="cursor-pointer text-lg font-semibold">+ Registrar movimiento</summary>
        <p className="mb-3 mt-1 text-sm text-apagado">
          Cobros de ventas, pagos de autos y gastos de cada auto se registran solos desde Ventas y Stock. Los sueldos y retiros quedan a nombre de una persona
          (se cargan en Configuración → Personas).
        </p>
        <FormMovimiento personas={personas} />
      </details>

      <section className="tarjeta flex flex-col gap-3 p-0">
        <FormFiltros plegable claseBarra="mx-4 max-md:mt-4" porDefecto={{ desde: `${hoy.slice(0, 8)}01`, hasta: hoy }} className="grid gap-3 p-4 pb-0 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
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
          <CamposFiltroAuto valores={filtroAuto} marcas={opciones.marcas} modelos={opciones.modelos} />
        </FormFiltros>
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
        <div className="md:overflow-x-auto">
          {mov.movimientos.length === 0 ? (
            <Vacio>No hay movimientos en este período.</Vacio>
          ) : (
            <table className="tabla tabla-tarjetas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <ThAuto />
                  <th>Persona</th>
                  <th>Medio</th>
                  <th className="text-right">Importe</th>
                  <th>Cargó</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mov.movimientos.map(({ m: x, usuario, manual, auto }) => (
                  <FilaEnlace key={x.id} href={`/caja/movimiento/${x.id}`} className={x.anulado ? "text-apagado line-through" : ""}>
                    <td className="num max-md:order-4 max-md:text-xs max-md:text-apagado">{fecha(x.fecha)}</td>
                    <td className="max-md:order-1 max-md:font-semibold">
                      <span className="flex items-center gap-2.5">
                        <InsigniaMovimiento categoria={x.categoria} sentido={x.sentido} anulado={x.anulado} />
                        {ETIQUETA_CATEGORIA[x.categoria]}
                      </span>
                    </td>
                    <td className="max-w-md whitespace-normal max-md:order-3 max-md:max-w-none max-md:basis-full max-md:text-[15px]">
                      {x.operacionId ? <Link href={`/ventas/${x.operacionId}`}>{x.concepto}</Link> : x.vehiculoId ? <Link href={`/stock/${x.vehiculoId}`}>{x.concepto}</Link> : x.concepto}
                      {x.anulado && x.motivoAnulacion && <span className="block text-xs no-underline">Anulado: {x.motivoAnulacion}</span>}
                    </td>
                    <TdAuto auto={auto?.id ? auto : null} href={auto?.id ? `/stock/${auto.id}` : undefined} clase="max-md:order-5 max-md:text-xs" />
                    <td className="max-md:order-7 max-md:text-xs max-md:text-apagado">{personas.find((p) => p.id === x.personaId)?.nombre ?? ""}</td>
                    <td className="max-md:order-6 max-md:text-xs max-md:text-apagado">{x.medio === "EFECTIVO" ? "Efectivo" : "Banco"}</td>
                    <td className={`num text-right max-md:order-2 max-md:ml-auto max-md:font-semibold ${x.sentido === "INGRESO" ? "text-ok-texto" : "text-aviso-texto"}`}>
                      {x.sentido === "INGRESO" ? "+ " : "− "}
                      {m(x.importe)}
                    </td>
                    <td className="max-md:hidden">{usuario}</td>
                    <td className="whitespace-nowrap max-md:order-8 max-md:basis-full">
                      <Link href={`/caja/movimiento/${x.id}`} className="text-sm no-underline max-md:hidden">
                        Ver →
                      </Link>
                      {manual && !x.anulado && <FormAnular id={x.id} />}
                    </td>
                  </FilaEnlace>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
