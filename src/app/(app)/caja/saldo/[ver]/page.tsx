import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { Ayuda } from "@/components/ui";
import { FilaEnlace, FormFiltros } from "@/components/filtros";
import { AutoEnLinea, CamposFiltroAuto, TdAuto, ThAuto } from "@/components/auto";
import { leerFiltroAuto, opcionesAuto } from "@/domain/autos";
import { vistaMoneda } from "@/lib/moneda";
import { leerNumero } from "@/lib/form";
import { detalleSaldo, listarCuentas, patrimonio, pendientesPorPagar } from "@/server/caja";
import { fecha } from "@/lib/formato";
import { r2 } from "@/domain/negocio";
import { esEditable, ETIQUETA_CATEGORIA, type FiltroDetalle, type Medio } from "@/domain/caja";
import { Vacio } from "@/components/ilustraciones";
import { Icono, InsigniaMovimiento, type NombreIcono } from "@/components/iconos-caja";

// HU-5.2: al tocar una tarjeta de Caja, de dónde sale ese saldo, movimiento por movimiento.
const VISTAS: Record<string, { titulo: string; icono: NombreIcono; medio?: Medio; bajada: string }> = {
  efectivo: { titulo: "Efectivo", icono: "efectivo", medio: "EFECTIVO", bajada: "Todos los movimientos en efectivo desde el principio, del más nuevo al más viejo." },
  banco: { titulo: "Banco", icono: "banco", medio: "BANCO", bajada: "Todos los movimientos del banco desde el principio, del más nuevo al más viejo." },
  total: { titulo: "Total en caja", icono: "total", bajada: "Todos los movimientos, en efectivo y en banco, desde el principio, del más nuevo al más viejo." },
  salon: { titulo: "Del salón", icono: "salon", bajada: "De la plata que hay en caja, cuánto es del salón y cuánto se les debe a los inversores (K11)." },
};

export async function generateMetadata({ params }: { params: Promise<{ ver: string }> }) {
  const v = VISTAS[(await params).ver];
  return { title: `${v?.titulo ?? "Saldo"} · Caja · Colombia Automotores` };
}

type Busqueda = { desde?: string; hasta?: string; categoria?: string; q?: string; min?: string; max?: string; marca?: string; modelo?: string; patente?: string };

/** Pasa los filtros de la URL al dominio. Un importe que no se entiende se ignora. */
function leerFiltro(sp: Busqueda): FiltroDetalle {
  const n = (v?: string) => (v?.trim() ? (leerNumero(v.trim()) ?? undefined) : undefined);
  return {
    desde: sp.desde ? new Date(`${sp.desde}T00:00:00-03:00`) : undefined,
    hasta: sp.hasta ? new Date(`${sp.hasta}T23:59:59.999-03:00`) : undefined,
    categoria: sp.categoria || undefined,
    q: sp.q,
    min: n(sp.min),
    max: n(sp.max),
  };
}

export default async function DetalleSaldoPage({ params, searchParams }: { params: Promise<{ ver: string }>; searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const { ver } = await params;
  const sp = await searchParams;
  const vista = VISTAS[ver];
  if (!vista) notFound();
  const { m } = await vistaMoneda();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link href="/caja" className="text-sm">
          ← Volver a Caja
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-info-fondo text-info-texto">
            <Icono nombre={vista.icono} className="size-7" />
          </span>
          <h1 className="text-3xl font-bold">{vista.titulo}</h1>
        </div>
        <p className="max-w-2xl text-suave">{vista.bajada}</p>
        <nav aria-label="Otros saldos" className="flex flex-wrap gap-2.5">
          {Object.entries(VISTAS).map(([k, v]) => (
            <Link
              key={k}
              href={`/caja/saldo/${k}`}
              aria-current={k === ver ? "page" : undefined}
              className={`chip inline-flex flex-row items-center gap-1.5 px-3.5 py-2 text-[13px] ${k === ver ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}
            >
              <Icono nombre={v.icono} className="size-4" />
              {v.titulo}
            </Link>
          ))}
        </nav>
        {ver !== "salon" && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-apagado">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-ok-fondo ring-1 ring-ok-texto" /> Entró plata
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-aviso-fondo ring-1 ring-aviso-texto" /> Salió plata
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icono nombre="lapiz" className="size-3.5" /> Se puede corregir desde Caja
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icono nombre="candado" className="size-3.5" /> Se corrige en el trámite que lo generó
            </span>
          </p>
        )}
      </header>
      {ver === "salon" ? <DelSalon m={m} /> : <Movimientos m={m} medio={vista.medio} sp={sp} />}
    </div>
  );
}

type Moneda = (v: number) => string;

async function Movimientos({ m, medio, sp }: { m: Moneda; medio?: Medio; sp: Busqueda }) {
  const filtroAuto = leerFiltroAuto(sp);
  const d = await detalleSaldo(medio, leerFiltro(sp), filtroAuto);
  const { marcas, modelos } = opcionesAuto(d.autos);
  const filtrado = Object.values(sp).some((v) => v?.trim());
  const saldo = medio === "EFECTIVO" ? d.saldos.efectivo : medio === "BANCO" ? d.saldos.banco : d.saldos.total;
  const ingresos = r2(d.resumen.reduce((a, c) => a + c.ingresos, 0));
  const egresos = r2(d.resumen.reduce((a, c) => a + c.egresos, 0));
  const neto = r2(ingresos - egresos);

  return (
    <>
      <section aria-label="Filtros" className="tarjeta flex flex-col gap-3 p-0 pb-4">
        <FormFiltros plegable claseBarra="mx-4 max-md:mt-4" className="grid gap-3 p-4 pb-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">
          <label className="campo">
            Desde
            <input type="date" name="desde" defaultValue={sp.desde} />
          </label>
          <label className="campo">
            Hasta
            <input type="date" name="hasta" defaultValue={sp.hasta} />
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
            Concepto
            <input type="search" name="q" defaultValue={sp.q} placeholder="Ej: gestoría, Peugeot" />
          </label>
          <label className="campo">
            Importe desde ($)
            <input name="min" inputMode="numeric" defaultValue={sp.min} placeholder="0" />
          </label>
          <label className="campo">
            Importe hasta ($)
            <input name="max" inputMode="numeric" defaultValue={sp.max} placeholder="Sin tope" />
          </label>
          <CamposFiltroAuto valores={filtroAuto} marcas={marcas} modelos={modelos} />
        </FormFiltros>
      </section>

      <section className="tarjeta flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {filtrado ? "Resumen de lo filtrado" : "Resumen por tipo"}
            <Ayuda>
              Cuánto entró y salió por cada tipo de movimiento. Sin filtros, la suma de todo da el saldo actual. Con filtros, suma solo lo que se ve. Los movimientos
              anulados no cuentan.
            </Ayuda>
          </h2>
          <span className="text-sm">
            Saldo actual <b className={`num text-xl ${saldo < 0 ? "text-aviso-texto" : ""}`}>{m(saldo)}</b>
          </span>
        </div>
        {d.resumen.length === 0 ? (
          <p className="text-sm text-apagado">{filtrado ? "Ningún movimiento coincide con los filtros." : "Todavía no hay movimientos."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Entró</th>
                  <th className="text-right">Salió</th>
                  <th className="text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {d.resumen.map((c) => (
                  <tr key={c.categoria}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <InsigniaMovimiento categoria={c.categoria} sentido={c.neto >= 0 ? "INGRESO" : "EGRESO"} />
                        {ETIQUETA_CATEGORIA[c.categoria] ?? c.categoria}
                      </span>
                    </td>
                    <td className="num text-right">{c.cantidad}</td>
                    <td className="num text-right text-ok-texto">{c.ingresos ? `+ ${m(c.ingresos)}` : ""}</td>
                    <td className="num text-right text-aviso-texto">{c.egresos ? `− ${m(c.egresos)}` : ""}</td>
                    <td className={`num text-right font-semibold ${c.neto < 0 ? "text-aviso-texto" : ""}`}>{m(c.neto)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-tinta font-semibold">
                  <td>{filtrado ? "Total de lo filtrado" : "Total"}</td>
                  <td />
                  <td className="num text-right text-ok-texto">+ {m(ingresos)}</td>
                  <td className="num text-right text-aviso-texto">− {m(egresos)}</td>
                  <td className={`num text-right ${neto < 0 ? "text-aviso-texto" : ""}`}>{m(neto)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta flex flex-col gap-3 p-0">
        <h2 className="px-4 pt-4 text-lg font-semibold">
          Movimiento por movimiento
          <Ayuda>
            Los más nuevos arriba. La columna Saldo muestra cómo quedó la plata después de cada movimiento, contando toda la historia aunque haya filtros: el de la
            primera fila sin filtros es el saldo actual. Tocá una fila para ver el movimiento, ir al trámite que lo generó y corregirlo o anularlo.
          </Ayuda>
        </h2>
        <div className="overflow-x-auto">
          {d.movimientos.length === 0 ? (
            <Vacio>{filtrado ? "Ningún movimiento coincide con los filtros." : "Todavía no hay movimientos."}</Vacio>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <ThAuto />
                  <th>Persona</th>
                  {!medio && <th>Medio</th>}
                  <th className="text-right">Entró</th>
                  <th className="text-right">Salió</th>
                  <th className="text-right">Saldo</th>
                  <th>Cargó</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.movimientos.map((x) => (
                  <FilaEnlace key={x.id} href={`/caja/movimiento/${x.id}`} className={x.anulado ? "text-apagado line-through" : ""}>
                    <td className="num">{fecha(x.fecha)}</td>
                    <td>
                      <span className="flex items-center gap-2.5 no-underline">
                        <InsigniaMovimiento categoria={x.categoria} sentido={x.sentido} anulado={x.anulado} />
                        {ETIQUETA_CATEGORIA[x.categoria]}
                      </span>
                    </td>
                    <td className="max-w-md whitespace-normal">
                      {x.operacionId ? <Link href={`/ventas/${x.operacionId}`}>{x.concepto}</Link> : x.vehiculoId ? <Link href={`/stock/${x.vehiculoId}`}>{x.concepto}</Link> : x.concepto}
                      {x.anulado && <span className="block text-xs no-underline">Anulado{x.motivoAnulacion ? `: ${x.motivoAnulacion}` : ""} · no cuenta en el saldo</span>}
                    </td>
                    <TdAuto auto={x.auto?.id ? x.auto : null} href={x.auto?.id ? `/stock/${x.auto.id}` : undefined} />
                    <td>{x.persona ?? ""}</td>
                    {!medio && <td>{x.medio === "EFECTIVO" ? "Efectivo" : "Banco"}</td>}
                    <td className="num text-right text-ok-texto">{x.sentido === "INGRESO" ? `+ ${m(x.importe)}` : ""}</td>
                    <td className="num text-right text-aviso-texto">{x.sentido === "EGRESO" ? `− ${m(x.importe)}` : ""}</td>
                    <td className={`num text-right font-semibold ${x.saldo < 0 ? "text-aviso-texto" : ""}`}>{m(x.saldo)}</td>
                    <td>{x.usuario}</td>
                    <td>
                      <Link
                        href={`/caja/movimiento/${x.id}`}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm no-underline"
                        title={esEditable(x.categoria) ? "Se puede corregir desde Caja" : "Se corrige en el trámite que lo generó"}
                      >
                        <Icono nombre={esEditable(x.categoria) ? "lapiz" : "candado"} className="size-4 text-apagado" />
                        Ver
                      </Link>
                    </td>
                  </FilaEnlace>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

async function DelSalon({ m }: { m: Moneda }) {
  const [p, pendientes, cuentas] = await Promise.all([patrimonio(), pendientesPorPagar(), listarCuentas({ tipo: "A_PAGAR" })]);
  const deInversores = pendientes.filter((x) => x.participe.tipo === "INVERSOR");
  const deConsignantes = cuentas.filter((x) => x.c.origen === "CONSIGNANTE");
  const c = p.conciliacion;

  return (
    <>
      <section className="tarjeta flex flex-col">
        <div className="flex items-center justify-between gap-2 py-2.5 text-sm">
          <span>
            <b>Total en caja</b> <span className="text-apagado">· efectivo + banco</span> · <Link href="/caja/saldo/total">ver movimientos</Link>
          </span>
          <span className="num font-semibold">{m(p.caja.total)}</span>
        </div>
        {deInversores.length + deConsignantes.length === 0 && (
          <p className="border-t border-linea py-2.5 text-sm text-apagado">No se les debe nada a inversores ni a consignantes: toda la plata de la caja es del salón.</p>
        )}
        {deInversores.map((g) => (
          <div key={g.d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linea py-2.5 text-sm">
            <span className="flex flex-wrap items-center gap-x-1.5">
              Menos {g.d.tipo === "CAPITAL" ? "devolución de capital" : "ganancia"} pendiente a <b>{g.participe.nombre}</b> ·
              <Link href={`/ventas/${g.operacionId}`} className="num">
                {g.numero}
              </Link>
              <AutoEnLinea auto={g.auto} anio />
            </span>
            <span className={`num ${g.d.importe < 0 ? "text-ok-texto" : "text-aviso-texto"}`}>
              {g.d.importe < 0 ? "+ " : "− "}
              {m(Math.abs(g.d.importe))}
            </span>
          </div>
        ))}
        {deConsignantes.map(({ c: x, auto }) => (
          <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linea py-2.5 text-sm">
            <span className="flex flex-wrap items-center gap-x-1.5">
              Menos lo pactado con <b>{x.contraparte}</b> (consignación)
              {auto?.id && <AutoEnLinea auto={auto} />}
            </span>
            <span className="num text-aviso-texto">− {m(x.saldo)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 border-t-2 border-tinta py-2.5">
          <b>Del salón</b>
          <b className={`num text-xl ${p.cajaSalon < 0 ? "text-aviso-texto" : ""}`}>{m(p.cajaSalon)}</b>
        </div>
        <p className="pt-1 text-[13px] text-apagado">
          Lo que los inversores tienen en autos todavía en stock no se descuenta: esa plata no está en la caja, está en el auto. Una línea en verde es una
          pérdida que el inversor tiene que reintegrar.
        </p>
        {p.cajaSalon < 0 && (
          <p role="status" className="mt-2 rounded-lg bg-aviso-fondo px-3 py-2 text-sm text-aviso-texto">
            <b>La caja del salón está en negativo:</b> se usó plata de inversores o consignantes (por ejemplo, para comprar autos del salón) o todavía no
            se cobró algo de una venta. Desde ahora el sistema no deja hacer pagos que la bajen más (K13).
          </p>
        )}
      </section>

      <section className="tarjeta flex flex-col">
        <h2 className="text-lg font-semibold">¿Por qué en Patrimonio el salón tiene otro número?</h2>
        <p className="pb-2 text-sm text-suave">Porque Patrimonio cuenta además lo que el salón tiene en autos y lo que le deben, y resta lo que debe:</p>
        {[
          { t: "Caja del salón (lo de arriba)", v: c.cajaSalon, s: c.cajaSalon < 0 ? "−" : "+" },
          { t: "Lo que el salón tiene en autos en stock", v: c.autos, s: "+" },
          { t: "Lo que le deben (a cobrar)", v: c.aCobrar, s: "+" },
          { t: "Lo que debe a terceros (a pagar)", v: c.aPagar, s: "−" },
        ].map((x) => (
          <div key={x.t} className="flex items-center justify-between gap-2 border-t border-linea py-2.5 text-sm">
            <span>{x.t}</span>
            <span className={`num ${x.s === "−" ? "text-aviso-texto" : ""}`}>
              {x.s} {m(Math.abs(x.v))}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 border-t-2 border-tinta py-2.5">
          <Link href="/patrimonio/desglose/salon" className="font-semibold">
            Del salón en Patrimonio →
          </Link>
          <b className="num text-xl">{m(p.salon)}</b>
        </div>
      </section>
    </>
  );
}
