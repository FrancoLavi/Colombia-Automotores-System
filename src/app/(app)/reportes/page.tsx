import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import * as rep from "@/server/reportes";
import { fecha, porcentaje } from "@/lib/formato";
import { nombreMes } from "@/domain/dashboard";
import { ETIQUETA_CATEGORIA } from "@/domain/caja";
import { ETIQUETA_ESTADO } from "@/domain/stock";
import { IlustracionReportes, Vacio } from "@/components/ilustraciones";

export const metadata = { title: "Reportes · Colombia Automotores" };

const PESTANAS = [
  { clave: "ganancias", texto: "Ganancias pagadas" },
  { clave: "personas", texto: "Sueldos y retiros" },
  { clave: "ventas", texto: "Ventas" },
  { clave: "autos", texto: "Movimiento de autos" },
  { clave: "movimientos", texto: "Ingresos y egresos" },
] as const;
type Clave = (typeof PESTANAS)[number]["clave"];
type Fmt = (n: number | null | undefined) => string;

const mesCorto = (p: string) => nombreMes(p).slice(0, 3);

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ ver?: string; anio?: string }> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const ver: Clave = (PESTANAS.find((p) => p.clave === sp.ver)?.clave ?? "ganancias") as Clave;
  const anios = await rep.aniosDisponibles();
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[0];
  const { m } = await vistaMoneda();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold">Reportes</h1>
          <nav aria-label="Reportes" className="flex flex-wrap gap-2.5">
            {PESTANAS.map((p) => (
              <Link
                key={p.clave}
                href={`/reportes?ver=${p.clave}&anio=${anio}`}
                aria-current={ver === p.clave ? "page" : undefined}
                className={`chip px-3.5 py-2 text-[13px] ${ver === p.clave ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}
              >
                {p.texto}
              </Link>
            ))}
          </nav>
        </div>
        <div className="ml-auto flex items-end gap-4">
          <form method="get" className="flex items-end gap-2">
            <input type="hidden" name="ver" value={ver} />
            <label className="campo">
              Año
              <select name="anio" defaultValue={anio}>
                {anios.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <button className="btn-secundario">Ver</button>
          </form>
          <IlustracionReportes className="hidden h-20 w-auto lg:block" />
        </div>
      </header>

      {ver === "ganancias" && <Ganancias anio={anio} m={m} />}
      {ver === "personas" && <Personas anio={anio} m={m} />}
      {ver === "ventas" && <Ventas anio={anio} m={m} />}
      {ver === "autos" && <Autos anio={anio} m={m} />}
      {ver === "movimientos" && <Movimientos anio={anio} m={m} />}
    </div>
  );
}

async function Ganancias({ anio, m }: { anio: number; m: Fmt }) {
  const g = await rep.gananciasPagadasPorMes(anio);
  if (!g.participes.length) return <section className="tarjeta"><Vacio>Todavía no se pagaron ganancias en {anio}. Se pagan desde Caja después de cerrar cada venta.</Vacio></section>;
  return (
    <section className="tarjeta flex flex-col gap-3 p-0">
      <p className="px-4 pt-4 text-sm text-suave">Lo efectivamente pagado o retirado de cada venta, según el mes del pago.</p>
      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Mes</th>
              {g.participes.map((p) => (
                <th key={p.id} className="text-right">
                  {p.tipo === "SALON" ? "Salón" : p.nombre}
                </th>
              ))}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {g.meses.map((x) => (
              <tr key={x.periodo} className={x.total ? "" : "text-apagado"}>
                <td>{nombreMes(x.periodo)}</td>
                {g.participes.map((p) => (
                  <td key={p.id} className="num text-right">
                    {x.porParticipe[p.id] ? m(x.porParticipe[p.id]) : "—"}
                  </td>
                ))}
                <td className="num text-right font-semibold">{x.total ? m(x.total) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-semibold">Total {anio}</td>
              {g.participes.map((p) => (
                <td key={p.id} className="num text-right font-semibold">
                  {m(g.totales[p.id])}
                </td>
              ))}
              <td className="num text-right font-semibold">{m(g.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

async function Personas({ anio, m }: { anio: number; m: Fmt }) {
  const { resumen, detalle } = await rep.retirosPorPersona(anio);
  if (!resumen.length)
    return (
      <section className="tarjeta">
        <Vacio>
          No hay personas cargadas. Agregalas en <Link href="/configuracion">Configuración → Personas</Link> y registrá los sueldos y retiros desde Caja.
        </Vacio>
      </section>
    );
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {resumen.map((r) => (
          <div key={r.persona.id} className="tarjeta flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{r.persona.nombre}</h2>
              <span className="text-sm text-apagado">{r.persona.rol === "SOCIO" ? "Socio" : "Empleado"}</span>
            </div>
            <div className="num text-2xl">{m(r.total)}</div>
            <div className="text-[13px] text-apagado">
              Sueldos {m(r.sueldos)} · Retiros {m(r.retiros)}
              {r.aportes ? ` · Aportes −${m(r.aportes)}` : ""}
            </div>
            <div className="flex h-12 items-end gap-0.5" role="img" aria-label={`Por mes: ${r.porMes.map((v, i) => `${mesCorto(rep.mesesDelAnio(anio)[i])} ${m(v)}`).join(", ")}`}>
              {r.porMes.map((v, i) => {
                const max = Math.max(1, ...r.porMes);
                return <div key={i} className="flex-1 rounded-t bg-acento/70" style={{ height: `${Math.max(0, (v / max) * 100)}%` }} />;
              })}
            </div>
          </div>
        ))}
      </section>
      <section className="tarjeta flex flex-col p-0">
        <h2 className="p-4 pb-2 text-lg font-semibold">Detalle</h2>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Persona</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th className="text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {detalle.map((d) => (
                <tr key={d.m.id}>
                  <td className="num">{fecha(d.m.fecha)}</td>
                  <td>{d.persona.nombre}</td>
                  <td>{ETIQUETA_CATEGORIA[d.m.categoria]}</td>
                  <td className="max-w-md whitespace-normal">{d.m.concepto}</td>
                  <td className="num text-right">{m(d.m.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

async function Ventas({ anio, m }: { anio: number; m: Fmt }) {
  const { ventas, porMes } = await rep.historicoVentas(anio);
  const tot = porMes.reduce((a, x) => ({ u: a.u + x.unidades, f: a.f + x.facturado, g: a.g + x.ganancia, s: a.s + x.salon, i: a.i + x.inversores }), { u: 0, f: 0, g: 0, s: 0, i: 0 });
  return (
    <>
      <section className="tarjeta overflow-x-auto p-0">
        <table className="tabla">
          <thead>
            <tr>
              <th>Mes</th>
              <th className="text-right">Autos</th>
              <th className="text-right">Facturado</th>
              <th className="text-right">Ganancia</th>
              <th className="text-right">Salón</th>
              <th className="text-right">Inversores</th>
            </tr>
          </thead>
          <tbody>
            {porMes.map((x) => (
              <tr key={x.periodo} className={x.unidades ? "" : "text-apagado"}>
                <td>{nombreMes(x.periodo)}</td>
                <td className="num text-right">{x.unidades || "—"}</td>
                <td className="num text-right">{x.unidades ? m(x.facturado) : "—"}</td>
                <td className="num text-right">{x.unidades ? m(x.ganancia) : "—"}</td>
                <td className="num text-right">{x.unidades ? m(x.salon) : "—"}</td>
                <td className="num text-right">{x.unidades ? m(x.inversores) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td>Total {anio}</td>
              <td className="num text-right">{tot.u}</td>
              <td className="num text-right">{m(tot.f)}</td>
              <td className="num text-right">{m(tot.g)}</td>
              <td className="num text-right">{m(tot.s)}</td>
              <td className="num text-right">{m(tot.i)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      <section className="tarjeta flex flex-col p-0">
        <h2 className="p-4 pb-2 text-lg font-semibold">Ventas del año</h2>
        {ventas.length === 0 ? (
          <Vacio>No hay ventas cerradas en {anio}.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Cierre</th>
                  <th>Auto</th>
                  <th>Cliente</th>
                  <th>Financia</th>
                  <th className="text-right">Precio</th>
                  <th className="text-right">Costo</th>
                  <th className="text-right">Ganancia</th>
                  <th className="text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.op.id}>
                    <td>
                      <Link href={`/ventas/${v.op.id}`} className="num">
                        {v.numero}
                      </Link>
                    </td>
                    <td className="num">{fecha(v.op.fechaCierre)}</td>
                    <td>
                      {v.auto.marca} {v.auto.modelo} {v.auto.anio} <span className="num text-apagado">{v.auto.dominio}</span>
                    </td>
                    <td>
                      {v.cliente.nombre} {v.cliente.apellido}
                    </td>
                    <td>{v.financista}</td>
                    <td className="num text-right">{m(v.l.precio)}</td>
                    <td className="num text-right">{m(v.l.costo)}</td>
                    <td className={`num text-right ${v.l.ganancia < 0 ? "text-aviso-texto" : ""}`}>{m(v.l.ganancia)}</td>
                    <td className="num text-right">{v.l.costo ? porcentaje(v.l.ganancia / v.l.costo) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

async function Autos({ anio, m }: { anio: number; m: Fmt }) {
  const { autos, movimientos } = await rep.historicoAutos(anio);
  return (
    <>
      <section className="tarjeta flex flex-col p-0">
        <h2 className="p-4 pb-2 text-lg font-semibold">Autos que entraron o salieron en {anio}</h2>
        {autos.length === 0 ? (
          <Vacio>No hubo movimiento de autos en {anio}.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Auto</th>
                  <th>Ingreso</th>
                  <th>Tipo</th>
                  <th>Financia</th>
                  <th>Venta</th>
                  <th className="text-right">Días</th>
                  <th className="text-right">Costo</th>
                  <th className="text-right">Vendido en</th>
                  <th className="text-right">Ganancia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {autos.map((a) => (
                  <tr key={a.v.id}>
                    <td>
                      <Link href={`/stock/${a.v.id}`} className="text-tinta">
                        {a.v.marca} {a.v.modelo} {a.v.anio} <span className="num text-apagado">{a.v.dominio}</span>
                      </Link>
                    </td>
                    <td className="num">{fecha(a.v.fechaIngreso)}</td>
                    <td className="lowercase">{a.v.tipoIngreso}</td>
                    <td>{a.financista}</td>
                    <td>{a.venta?.id ? <Link href={`/ventas/${a.venta.id}`}>{`${a.numero} · ${fecha(a.venta.fechaCierre)}`}</Link> : "—"}</td>
                    <td className="num text-right">{a.dias}</td>
                    <td className="num text-right">{a.l?.costo != null ? m(a.l.costo) : "—"}</td>
                    <td className="num text-right">{a.l?.precio != null ? m(a.l.precio) : "—"}</td>
                    <td className="num text-right">{a.l?.ganancia != null ? m(a.l.ganancia) : "—"}</td>
                    <td>{ETIQUETA_ESTADO[a.v.estado]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="tarjeta flex flex-col">
        <h2 className="pb-2 text-lg font-semibold">Cambios de estado y ubicación</h2>
        {movimientos.length === 0 && <p className="text-sm text-apagado">Sin movimientos.</p>}
        {movimientos.map(({ a, usuario, auto }) => (
          <div key={a.id} className="flex flex-wrap gap-x-4 border-t border-linea py-2 text-sm">
            <span className="num min-w-36 text-apagado">{a.fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
            <Link href={`/stock/${auto.id}`} className="min-w-48 text-tinta">
              {auto.marca} {auto.modelo} <span className="num text-apagado">{auto.dominio}</span>
            </Link>
            <span>
              {a.descripcion} <span className="text-apagado">· {usuario ?? "Sistema"}</span>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

async function Movimientos({ anio, m }: { anio: number; m: Fmt }) {
  const { meses, categorias } = await rep.resumenMensual(anio);
  const total = (f: (x: (typeof meses)[number]) => number) => meses.reduce((a, x) => a + f(x), 0);
  return (
    <>
      <section className="tarjeta overflow-x-auto p-0">
        <table className="tabla">
          <thead>
            <tr>
              <th>Mes</th>
              <th className="text-right">Ingresos</th>
              <th className="text-right">Egresos</th>
              <th className="text-right">Neto</th>
              <th className="text-right">Sueldos</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((x) => (
              <tr key={x.periodo} className={x.ingresos || x.egresos ? "" : "text-apagado"}>
                <td>{nombreMes(x.periodo)}</td>
                <td className="num text-right text-ok-texto">{x.ingresos ? m(x.ingresos) : "—"}</td>
                <td className="num text-right text-aviso-texto">{x.egresos ? m(x.egresos) : "—"}</td>
                <td className="num text-right font-semibold">{x.ingresos || x.egresos ? m(x.ingresos - x.egresos) : "—"}</td>
                <td className="num text-right">{x.sueldos ? m(x.sueldos) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td>Total {anio}</td>
              <td className="num text-right">{m(total((x) => x.ingresos))}</td>
              <td className="num text-right">{m(total((x) => x.egresos))}</td>
              <td className="num text-right">{m(total((x) => x.ingresos - x.egresos))}</td>
              <td className="num text-right">{m(total((x) => x.sueldos))}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      {categorias.length > 0 && (
        <section className="tarjeta flex flex-col p-0">
          <h2 className="p-4 pb-2 text-lg font-semibold">Por tipo de movimiento</h2>
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Tipo</th>
                  {meses.map((x) => (
                    <th key={x.periodo} className="text-right">
                      {mesCorto(x.periodo)}
                    </th>
                  ))}
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => {
                  const [sentido, cat] = c.split(":");
                  return (
                    <tr key={c}>
                      <td>
                        <span className={sentido === "INGRESO" ? "text-ok-texto" : "text-aviso-texto"}>{sentido === "INGRESO" ? "+" : "−"}</span> {ETIQUETA_CATEGORIA[cat]}
                      </td>
                      {meses.map((x) => (
                        <td key={x.periodo} className="num text-right">
                          {x.porCategoria[c] ? m(x.porCategoria[c]) : ""}
                        </td>
                      ))}
                      <td className="num text-right font-semibold">{m(total((x) => x.porCategoria[c] ?? 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
