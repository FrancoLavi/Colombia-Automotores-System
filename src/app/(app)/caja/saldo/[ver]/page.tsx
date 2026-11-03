import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { Ayuda } from "@/components/ui";
import { FilaEnlace, FormFiltros } from "@/components/filtros";
import { vistaMoneda } from "@/lib/moneda";
import { leerNumero } from "@/lib/form";
import { detalleSaldo, patrimonio, pendientesPorPagar } from "@/server/caja";
import { fecha } from "@/lib/formato";
import { r2 } from "@/domain/negocio";
import { ETIQUETA_CATEGORIA, type FiltroDetalle, type Medio } from "@/domain/caja";
import { Vacio } from "@/components/ilustraciones";

// HU-5.2: al tocar una tarjeta de Caja, de dónde sale ese saldo, movimiento por movimiento.
const VISTAS: Record<string, { titulo: string; medio?: Medio; bajada: string }> = {
  efectivo: { titulo: "Efectivo", medio: "EFECTIVO", bajada: "Todos los movimientos en efectivo desde el principio, del más nuevo al más viejo." },
  banco: { titulo: "Banco", medio: "BANCO", bajada: "Todos los movimientos del banco desde el principio, del más nuevo al más viejo." },
  total: { titulo: "Total en caja", bajada: "Todos los movimientos, en efectivo y en banco, desde el principio, del más nuevo al más viejo." },
  salon: { titulo: "Del salón", bajada: "De la plata que hay en caja, cuánto es del salón y cuánto se les debe a los inversores (K11)." },
};

export async function generateMetadata({ params }: { params: Promise<{ ver: string }> }) {
  const v = VISTAS[(await params).ver];
  return { title: `${v?.titulo ?? "Saldo"} · Caja · Colombia Automotores` };
}

type Busqueda = { desde?: string; hasta?: string; categoria?: string; q?: string; min?: string; max?: string };

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
        <h1 className="text-3xl font-bold">{vista.titulo}</h1>
        <p className="max-w-2xl text-suave">{vista.bajada}</p>
        <nav aria-label="Otros saldos" className="flex flex-wrap gap-2.5">
          {Object.entries(VISTAS).map(([k, v]) => (
            <Link
              key={k}
              href={`/caja/saldo/${k}`}
              aria-current={k === ver ? "page" : undefined}
              className={`chip px-3.5 py-2 text-[13px] ${k === ver ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}
            >
              {v.titulo}
            </Link>
          ))}
        </nav>
      </header>
      {ver === "salon" ? <DelSalon m={m} /> : <Movimientos m={m} medio={vista.medio} sp={sp} />}
    </div>
  );
}

type Moneda = (v: number) => string;

async function Movimientos({ m, medio, sp }: { m: Moneda; medio?: Medio; sp: Busqueda }) {
  const d = await detalleSaldo(medio, leerFiltro(sp));
  const filtrado = Object.values(sp).some((v) => v?.trim());
  const saldo = medio === "EFECTIVO" ? d.saldos.efectivo : medio === "BANCO" ? d.saldos.banco : d.saldos.total;
  const ingresos = r2(d.resumen.reduce((a, c) => a + c.ingresos, 0));
  const egresos = r2(d.resumen.reduce((a, c) => a + c.egresos, 0));
  const neto = r2(ingresos - egresos);

  return (
    <>
      <section aria-label="Filtros" className="tarjeta flex flex-col gap-3 p-0 pb-4">
        <FormFiltros plegable claseBarra="mx-4 max-md:mt-4" className="grid gap-3 p-4 pb-0 sm:grid-cols-2 lg:grid-cols-6">
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
                    <td>{ETIQUETA_CATEGORIA[c.categoria] ?? c.categoria}</td>
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
                    <td>{ETIQUETA_CATEGORIA[x.categoria]}</td>
                    <td className="max-w-md whitespace-normal">
                      {x.operacionId ? <Link href={`/ventas/${x.operacionId}`}>{x.concepto}</Link> : x.vehiculoId ? <Link href={`/stock/${x.vehiculoId}`}>{x.concepto}</Link> : x.concepto}
                      {x.anulado && <span className="block text-xs no-underline">Anulado{x.motivoAnulacion ? `: ${x.motivoAnulacion}` : ""} · no cuenta en el saldo</span>}
                    </td>
                    <td>{x.persona ?? ""}</td>
                    {!medio && <td>{x.medio === "EFECTIVO" ? "Efectivo" : "Banco"}</td>}
                    <td className="num text-right text-ok-texto">{x.sentido === "INGRESO" ? `+ ${m(x.importe)}` : ""}</td>
                    <td className="num text-right text-aviso-texto">{x.sentido === "EGRESO" ? `− ${m(x.importe)}` : ""}</td>
                    <td className={`num text-right font-semibold ${x.saldo < 0 ? "text-aviso-texto" : ""}`}>{m(x.saldo)}</td>
                    <td>{x.usuario}</td>
                    <td>
                      <Link href={`/caja/movimiento/${x.id}`} className="whitespace-nowrap text-sm no-underline">
                        Ver →
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
  const [p, pendientes] = await Promise.all([patrimonio(), pendientesPorPagar()]);
  const deInversores = pendientes.filter((x) => x.participe.tipo === "INVERSOR");

  return (
    <section className="tarjeta flex flex-col">
      <div className="flex items-center justify-between gap-2 py-2.5 text-sm">
        <span>
          <b>Total en caja</b> <span className="text-apagado">· efectivo + banco</span> · <Link href="/caja/saldo/total">ver movimientos</Link>
        </span>
        <span className="num font-semibold">{m(p.caja.total)}</span>
      </div>
      {deInversores.length === 0 && (
        <p className="border-t border-linea py-2.5 text-sm text-apagado">No se les debe nada a los inversores: toda la plata de la caja es del salón.</p>
      )}
      {deInversores.map((g) => (
        <div key={g.d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linea py-2.5 text-sm">
          <span>
            Menos {g.d.tipo === "CAPITAL" ? "devolución de capital" : "ganancia"} pendiente a <b>{g.participe.nombre}</b> ·{" "}
            <Link href={`/ventas/${g.operacionId}`} className="num">
              {g.numero}
            </Link>{" "}
            <span className="text-apagado">
              {g.auto.marca} {g.auto.modelo} {g.auto.anio}
            </span>
          </span>
          <span className={`num ${g.d.importe < 0 ? "text-ok-texto" : "text-aviso-texto"}`}>
            {g.d.importe < 0 ? "+ " : "− "}
            {m(Math.abs(g.d.importe))}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 border-t-2 border-tinta py-2.5">
        <b>Del salón</b>
        <b className={`num text-xl ${p.cajaSalon < 0 ? "text-aviso-texto" : ""}`}>{m(p.cajaSalon)}</b>
      </div>
      <p className="pt-1 text-[13px] text-apagado">
        Lo que los inversores tienen en autos todavía en stock no se descuenta: esa plata no está en la caja, está en el auto. Se ve en{" "}
        <Link href="/patrimonio">Patrimonio</Link>. Una línea en verde es una pérdida que el inversor tiene que reintegrar.
      </p>
    </section>
  );
}
