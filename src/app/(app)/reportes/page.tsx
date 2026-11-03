import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import * as rep from "@/server/reportes";
import { nombreContacto, fecha, porcentaje, fechaHora } from "@/lib/formato";
import { nombreMes } from "@/domain/dashboard";
import { ETIQUETA_CATEGORIA } from "@/domain/caja";
import { ETIQUETA_ESTADO } from "@/domain/stock";
import { IlustracionGanancias, IlustracionIngresosEgresos, IlustracionMovimientoAutos, IlustracionPersonas, IlustracionVentas, Vacio } from "@/components/ilustraciones";
import { Icono, InsigniaMovimiento, type NombreIcono } from "@/components/iconos-caja";
import { FilaEnlace, FormFiltros } from "@/components/filtros";
import { AutoEnLinea, CamposFiltroAuto, TdAuto, ThAuto } from "@/components/auto";
import { leerFiltroAuto } from "@/domain/autos";
import { opcionesDeAutos } from "@/server/caja";

export const metadata = { title: "Reportes · Colombia Automotores" };

const PESTANAS = [
  {
    clave: "ganancias",
    texto: "Ganancias",
    icono: "inversor",
    porAuto: true,
    bajada:
      "Lo que ganó el salón y cada inversor con los autos que se vendieron, en el mes en que se cerró cada venta. Del inversor se ve cuánto ya cobró y cuánto falta. El capital que se le devuelve no es ganancia y no aparece.",
  },
  { clave: "personas", texto: "Sueldos y retiros", icono: "persona", porAuto: false, bajada: "Lo que se llevó cada socio y cada empleado: sueldos y retiros. Un aporte resta." },
  { clave: "ventas", texto: "Ventas", icono: "venta", porAuto: true, bajada: "Autos vendidos, cuánto se facturó y cuánto se ganó, y cómo se repartió entre el salón y los inversores." },
  { clave: "autos", texto: "Movimiento de autos", icono: "auto", porAuto: true, bajada: "Qué autos entraron y cuáles salieron, cuántos días estuvieron y en cuánto se vendieron." },
  { clave: "movimientos", texto: "Ingresos y egresos", icono: "pase", porAuto: false, bajada: "Toda la plata que entró y salió de la caja, por tipo. Los pases entre efectivo y banco no cuentan." },
] as const satisfies readonly { clave: string; texto: string; icono: NombreIcono; bajada: string; porAuto: boolean }[];
type Clave = (typeof PESTANAS)[number]["clave"];
type Fmt = (n: number | null | undefined) => string;
type Filtros = rep.FiltrosReporte;

/** Un dibujo por pestaña, para saber de un vistazo qué mide cada una. */
const DIBUJOS: Record<Clave, (p: { className?: string }) => React.ReactElement> = {
  ganancias: IlustracionGanancias,
  personas: IlustracionPersonas,
  ventas: IlustracionVentas,
  autos: IlustracionMovimientoAutos,
  movimientos: IlustracionIngresosEgresos,
};

const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const mesCorto = (p: string) => nombreMes(p).slice(0, 3);
const mesLargo = (p: string) => `${MESES_LARGOS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

type Busqueda = { ver?: string; anio?: string; mes?: string; marca?: string; modelo?: string; patente?: string };

export default async function ReportesPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const pestana = PESTANAS.find((p) => p.clave === sp.ver) ?? PESTANAS[0];
  const ver: Clave = pestana.clave;
  const anios = await rep.aniosDisponibles();
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[0];
  // El mes viene como "01".."12" y se combina con el año elegido.
  const mes = sp.mes && /^(0[1-9]|1[0-2])$/.test(sp.mes) ? `${anio}-${sp.mes}` : undefined;
  const auto = pestana.porAuto ? leerFiltroAuto(sp) : {};
  const f: Filtros = { mes, auto };
  const [{ m }, opciones] = await Promise.all([vistaMoneda(), opcionesDeAutos()]);
  const periodo = mes ? mesLargo(mes) : `todo ${anio}`;
  const Dibujo = DIBUJOS[ver];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Reportes</h1>
        <nav aria-label="Reportes" className="flex flex-wrap gap-2.5">
          {PESTANAS.map((p) => (
            <Link
              key={p.clave}
              href={`/reportes?ver=${p.clave}&anio=${anio}${sp.mes ? `&mes=${sp.mes}` : ""}`}
              aria-current={ver === p.clave ? "page" : undefined}
              className={`chip inline-flex flex-row items-center gap-1.5 px-3.5 py-2 text-[13px] ${ver === p.clave ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}
            >
              <Icono nombre={p.icono} className="size-4" />
              {p.texto}
            </Link>
          ))}
        </nav>
      </header>

      {/* Qué muestra esta pestaña, con su dibujo. */}
      <section className="flex flex-wrap items-center gap-5 rounded-2xl bg-panel px-5 py-4">
        <Dibujo className="h-20 w-auto shrink-0" />
        <div className="min-w-60 flex-1">
          <h2 className="text-lg font-semibold">
            {pestana.texto} · <span className="font-normal">{periodo}</span>
          </h2>
          <p className="max-w-2xl text-sm text-suave">{pestana.bajada}</p>
        </div>
      </section>

      <FormFiltros
        plegable
        fijos={["ver"]}
        porDefecto={{ ver: "ganancias", anio: String(anios[0]) }}
        className={`tarjeta grid gap-3.5 p-4 sm:grid-cols-2 ${pestana.porAuto ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
      >
        <input type="hidden" name="ver" value={ver} />
        <label className="campo">
          Año
          <select name="anio" defaultValue={anio}>
            {anios.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          Mes
          <select name="mes" defaultValue={sp.mes ?? ""}>
            <option value="">Todo el año</option>
            {MESES_LARGOS.map((n, i) => (
              <option key={n} value={String(i + 1).padStart(2, "0")}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {pestana.porAuto && <CamposFiltroAuto valores={auto} marcas={opciones.marcas} modelos={opciones.modelos} id="reporte" />}
      </FormFiltros>

      {ver === "ganancias" && <Ganancias anio={anio} f={f} m={m} />}
      {ver === "personas" && <Personas anio={anio} f={f} m={m} />}
      {ver === "ventas" && <Ventas anio={anio} f={f} m={m} />}
      {ver === "autos" && <Autos anio={anio} f={f} m={m} />}
      {ver === "movimientos" && <Movimientos anio={anio} f={f} m={m} />}
    </div>
  );
}

/** Barras de los 12 meses; con un mes elegido, ese queda resaltado. */
function BarrasMes({ valores, anio, mes, m, color = "bg-acento/70" }: { valores: number[]; anio: number; mes?: string; m: Fmt; color?: string }) {
  const max = Math.max(1, ...valores.map((v) => Math.abs(v)));
  const meses = rep.mesesDelAnio(anio);
  return (
    <div>
      <div className="flex h-14 items-end gap-0.5" role="img" aria-label={`Por mes: ${valores.map((v, i) => `${mesCorto(meses[i])} ${m(v)}`).join(", ")}`}>
        {valores.map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${mes && meses[i] !== mes ? "bg-linea" : color}`}
            style={{ height: `${Math.max(v ? 4 : 0, (Math.max(0, v) / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-[10px] text-apagado" aria-hidden="true">
        {meses.map((p) => (
          <span key={p} className={`flex-1 text-center ${p === mes ? "font-bold text-tinta" : ""}`}>
            {mesCorto(p).slice(0, 1)}
          </span>
        ))}
      </div>
    </div>
  );
}

async function Ganancias({ anio, f, m }: { anio: number; f: Filtros; m: Fmt }) {
  const g = await rep.gananciasPorDueno(anio, f);
  return (
    <>
      <section aria-label="Ganancia de cada uno" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {g.porDueno.map((d) => {
          const esSalon = d.participe.tipo === "SALON";
          const pct = d.total > 0 ? Math.min(100, Math.round((d.cobrado / d.total) * 100)) : 0;
          return (
            <div key={d.participe.id} className={`tarjeta flex flex-col gap-2 ${esSalon ? "border-tinta" : ""}`}>
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex size-10 items-center justify-center rounded-xl ${esSalon ? "bg-ok-fondo text-ok-texto" : "bg-info-fondo text-info-texto"}`}>
                  <Icono nombre={esSalon ? "salon" : "inversor"} />
                </span>
                <div>
                  <h3 className="font-semibold leading-tight">{esSalon ? "Salón" : d.participe.nombre}</h3>
                  <span className="text-[13px] text-apagado">
                    {esSalon ? "Los dueños" : "Inversor"} · {d.ventas} {d.ventas === 1 ? "venta" : "ventas"}
                  </span>
                </div>
              </div>
              <span className={`num text-3xl ${d.total < 0 ? "text-aviso-texto" : ""}`}>{m(d.total)}</span>
              {esSalon ? (
                <span className="text-[13px] text-apagado">Quedó en la caja del salón al cerrar cada venta. Lo que se lleva cada socio está en Sueldos y retiros.</span>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="h-2 rounded-full bg-aviso-fondo" aria-hidden="true">
                    <div className="h-2 rounded-full bg-ok" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[13px] text-apagado">
                    Cobró <b className="num text-ok-texto">{m(d.cobrado)}</b>
                    {d.pendiente !== 0 && (
                      <>
                        {" · falta "}
                        <Link href="/caja/cuentas#inversores" className="num font-semibold text-aviso-texto">
                          {m(d.pendiente)}
                        </Link>
                      </>
                    )}
                  </span>
                </div>
              )}
              <BarrasMes valores={d.porMes} anio={anio} mes={f.mes} m={m} color={esSalon ? "bg-ok/70" : "bg-acento/70"} />
            </div>
          );
        })}
      </section>

      {!f.mes && g.total !== 0 && (
        <section className="tarjeta tabla-scroll p-0">
          <h2 className="p-4 pb-2 text-lg font-semibold">Mes por mes</h2>
          <table className="tabla">
            <thead>
              <tr>
                <th>Mes</th>
                {g.porDueno.map((d) => (
                  <th key={d.participe.id} className="text-right">
                    {d.participe.tipo === "SALON" ? "Salón" : d.participe.nombre}
                  </th>
                ))}
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {g.meses.map((x) => (
                <tr key={x.periodo} className={x.total ? "" : "text-apagado"}>
                  <td>{mesLargo(x.periodo)}</td>
                  {g.porDueno.map((d) => (
                    <td key={d.participe.id} className="num text-right">
                      {x.porParticipe[d.participe.id] ? m(x.porParticipe[d.participe.id]) : "—"}
                    </td>
                  ))}
                  <td className="num text-right font-semibold">{x.total ? m(x.total) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="font-semibold">Total {anio}</td>
                {g.porDueno.map((d) => (
                  <td key={d.participe.id} className="num text-right font-semibold">
                    {m(d.total)}
                  </td>
                ))}
                <td className="num text-right font-semibold">{m(g.total)}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <section className="tarjeta flex flex-col p-0">
        <h2 className="p-4 pb-2 text-lg font-semibold">Venta por venta</h2>
        {g.ventas.length === 0 ? (
          <Vacio>No hay ventas cerradas con estos filtros. La ganancia se reparte al cerrar cada venta.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Cierre</th>
                  <ThAuto />
                  {g.porDueno.map((d) => (
                    <th key={d.participe.id} className="text-right">
                      {d.participe.tipo === "SALON" ? "Salón" : d.participe.nombre}
                    </th>
                  ))}
                  <th className="text-right">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {g.ventas.map((v) => (
                  <FilaEnlace key={v.op.id} href={`/ventas/${v.op.id}`}>
                    <td>
                      <Link href={`/ventas/${v.op.id}`} className="num">
                        {v.numero}
                      </Link>
                    </td>
                    <td className="num">{fecha(v.op.fechaCierre)}</td>
                    <TdAuto auto={v.auto} href={`/stock/${v.auto.id}`} anio />
                    {g.porDueno.map((d) => {
                      const x = v.partes[d.participe.id];
                      return (
                        <td key={d.participe.id} className="num text-right">
                          {x ? m(x.importe) : "—"}
                          {x?.pendiente && <span className="chip ml-1 bg-aviso-fondo text-aviso-texto">falta pagar</span>}
                        </td>
                      );
                    })}
                    <td className={`num text-right font-semibold ${v.total < 0 ? "text-aviso-texto" : ""}`}>{m(v.total)}</td>
                  </FilaEnlace>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

async function Personas({ anio, f, m }: { anio: number; f: Filtros; m: Fmt }) {
  const { resumen, detalle } = await rep.retirosPorPersona(anio, f);
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
            <BarrasMes valores={r.porMes} anio={anio} mes={f.mes} m={m} />
          </div>
        ))}
      </section>
      <section className="tarjeta flex flex-col p-0">
        <h2 className="p-4 pb-2 text-lg font-semibold">Detalle</h2>
        <div className="tabla-scroll">
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
              {detalle.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-apagado">
                    Nada en este período.
                  </td>
                </tr>
              )}
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

async function Ventas({ anio, f, m }: { anio: number; f: Filtros; m: Fmt }) {
  const { ventas, porMes } = await rep.historicoVentas(anio, f);
  const tot = porMes.reduce((a, x) => ({ u: a.u + x.unidades, f: a.f + x.facturado, g: a.g + x.ganancia, s: a.s + x.salon, i: a.i + x.inversores }), { u: 0, f: 0, g: 0, s: 0, i: 0 });
  return (
    <>
      <section className="tarjeta tabla-scroll p-0">
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
                <td>{mesLargo(x.periodo)}</td>
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
              <td>{f.mes ? "Total" : `Total ${anio}`}</td>
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
        <h2 className="p-4 pb-2 text-lg font-semibold">{f.mes ? "Ventas del mes" : "Ventas del año"}</h2>
        {ventas.length === 0 ? (
          <Vacio>No hay ventas cerradas con estos filtros.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Cierre</th>
                  <ThAuto />
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
                    <TdAuto auto={v.auto} href={`/stock/${v.auto.id}`} anio />
                    <td>
                      {nombreContacto(v.cliente)}
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

async function Autos({ anio, f, m }: { anio: number; f: Filtros; m: Fmt }) {
  const { autos, movimientos } = await rep.historicoAutos(anio, f);
  return (
    <>
      <section className="tarjeta flex flex-col p-0">
        <h2 className="p-4 pb-2 text-lg font-semibold">Autos que entraron o salieron</h2>
        {autos.length === 0 ? (
          <Vacio>No hubo movimiento de autos con estos filtros.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <ThAuto />
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
                    <TdAuto auto={a.v} href={`/stock/${a.v.id}`} anio />
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
        <div className="tabla-scroll">
          {movimientos.map(({ a, usuario, auto }) => (
            <div key={a.id} className="flex flex-wrap gap-x-4 border-t border-linea py-2 text-sm">
              <span className="num min-w-36 text-apagado">{fechaHora(a.fecha)}</span>
              <Link href={`/stock/${auto.id}`} className="min-w-56 text-tinta no-underline">
                <AutoEnLinea auto={auto} />
              </Link>
              <span>
                {a.descripcion} <span className="text-apagado">· {usuario ?? "Sistema"}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

async function Movimientos({ anio, f, m }: { anio: number; f: Filtros; m: Fmt }) {
  const { meses, categorias } = await rep.resumenMensual(anio, f);
  const total = (f: (x: (typeof meses)[number]) => number) => meses.reduce((a, x) => a + f(x), 0);
  return (
    <>
      <section className="tarjeta tabla-scroll p-0">
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
                <td>{mesLargo(x.periodo)}</td>
                <td className="num text-right text-ok-texto">{x.ingresos ? m(x.ingresos) : "—"}</td>
                <td className="num text-right text-aviso-texto">{x.egresos ? m(x.egresos) : "—"}</td>
                <td className="num text-right font-semibold">{x.ingresos || x.egresos ? m(x.ingresos - x.egresos) : "—"}</td>
                <td className="num text-right">{x.sueldos ? m(x.sueldos) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td>{f.mes ? "Total" : `Total ${anio}`}</td>
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
          <div className="tabla-scroll">
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
                        <span className="flex items-center gap-2.5">
                          <InsigniaMovimiento categoria={cat} sentido={sentido as "INGRESO" | "EGRESO"} />
                          {ETIQUETA_CATEGORIA[cat]}
                        </span>
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
