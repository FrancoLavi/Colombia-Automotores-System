import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { desglosePatrimonio } from "@/server/caja";
import { r2 } from "@/domain/negocio";
import { ChipEstado } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/iconos-caja";
import { FormFiltros } from "@/components/filtros";
import { AutoEnLinea, CamposFiltroAuto, TdAuto, ThAuto } from "@/components/auto";
import { coincideAuto, hayFiltroAuto, leerFiltroAuto, opcionesAuto, type FiltroAuto } from "@/domain/autos";

// Al tocar una tarjeta de Patrimonio, qué compone ese número (K3, K11), con cada parte a la vista.
const VISTAS: Record<string, { titulo: string; icono: NombreIcono; bajada: string }> = {
  total: { titulo: "Patrimonio total", icono: "total", bajada: "Todo lo que hay, sea del salón o de los inversores: caja, autos al costo y lo que hay por cobrar, menos lo que se debe (K3)." },
  salon: { titulo: "Del salón", icono: "salon", bajada: "Del patrimonio total, lo que es de los dueños: se resta lo que pusieron los inversores en autos en stock y lo que se les debe por autos vendidos (K11)." },
  autos: { titulo: "Invertido en autos", icono: "auto", bajada: "Cada auto en stock con lo que costó: valor de compra más gastos. Los consignados no suman porque no son del salón." },
  liquido: { titulo: "Disponible en caja", icono: "efectivo", bajada: "La plata líquida, en efectivo y en el banco, y cuánto de ella es del salón." },
};

export async function generateMetadata({ params }: { params: Promise<{ ver: string }> }) {
  const v = VISTAS[(await params).ver];
  return { title: `${v?.titulo ?? "Desglose"} · Patrimonio · Colombia Automotores` };
}

type Moneda = (v: number) => string;
type Desglose = Awaited<ReturnType<typeof desglosePatrimonio>>;

export default async function DesglosePage({ params, searchParams }: { params: Promise<{ ver: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requerirUsuario();
  const { ver } = await params;
  const filtro = leerFiltroAuto(await searchParams);
  const vista = VISTAS[ver];
  if (!vista) notFound();
  const [{ m }, d] = await Promise.all([vistaMoneda(), desglosePatrimonio()]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link href="/patrimonio" className="text-sm">
          ← Volver a Patrimonio
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-info-fondo text-info-texto">
            <Icono nombre={vista.icono} className="size-7" />
          </span>
          <h1 className="text-3xl font-bold">{vista.titulo}</h1>
        </div>
        <p className="max-w-2xl text-suave">{vista.bajada}</p>
        <nav aria-label="Otros números del patrimonio" className="flex flex-wrap gap-2.5">
          {Object.entries(VISTAS).map(([k, v]) => (
            <Link
              key={k}
              href={`/patrimonio/desglose/${k}`}
              aria-current={k === ver ? "page" : undefined}
              className={`chip inline-flex flex-row items-center gap-1.5 px-3.5 py-2 text-[13px] ${k === ver ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}
            >
              <Icono nombre={v.icono} className="size-4" />
              {v.titulo}
            </Link>
          ))}
        </nav>
      </header>
      {ver === "total" && <Total d={d} m={m} />}
      {ver === "salon" && <Salon d={d} m={m} />}
      {ver === "autos" && <Autos d={d} m={m} filtro={filtro} />}
      {ver === "liquido" && <Liquido d={d} m={m} />}
    </div>
  );
}

/** Una línea de la cuenta: suma o resta, con su enlace si se puede ir a ver de dónde sale. */
function Linea({ texto, detalle, href, importe, m, signo = "+", icono }: { texto: React.ReactNode; detalle?: React.ReactNode; href?: string; importe: number; m: Moneda; signo?: "+" | "−"; icono?: NombreIcono }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea py-2.5 text-sm">
      <span className="flex items-center gap-2.5">
        {icono && (
          <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${signo === "+" ? "bg-ok-fondo text-ok-texto" : "bg-aviso-fondo text-aviso-texto"}`}>
            <Icono nombre={icono} className="size-4" />
          </span>
        )}
        <span>
          {href ? <Link href={href}>{texto}</Link> : texto}
          {detalle && <span className="block text-[13px] text-apagado">{detalle}</span>}
        </span>
      </span>
      <span className={`num ${signo === "−" ? "text-aviso-texto" : ""}`}>
        {signo} {m(Math.abs(importe))}
      </span>
    </div>
  );
}

function Resultado({ texto, importe, m }: { texto: string; importe: number; m: Moneda }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t-2 border-tinta pt-2.5">
      <b>{texto}</b>
      <b className={`num text-xl ${importe < 0 ? "text-aviso-texto" : ""}`}>{m(importe)}</b>
    </div>
  );
}

function Total({ d, m }: { d: Desglose; m: Moneda }) {
  const { p } = d;
  return (
    <>
      <section className="tarjeta flex flex-col">
        <h2 className="pb-2 text-lg font-semibold">La cuenta</h2>
        <Linea icono="efectivo" texto="Disponible en caja" detalle="Efectivo + banco" href="/caja/saldo/total" importe={p.caja.total} m={m} signo={p.caja.total < 0 ? "−" : "+"} />
        <Linea icono="auto" texto={`Autos en stock, al costo (${p.autosEnStock})`} detalle={p.stockInversores > 0 ? `${m(p.stockInversores)} los puso un inversor` : undefined} href="/patrimonio/desglose/autos" importe={p.stock} m={m} />
        <Linea icono="cuenta" texto={`A cobrar (${d.aCobrar.length})`} detalle="Créditos y saldos que todavía no entraron" href="/caja/cuentas" importe={p.aCobrar} m={m} />
        <Linea icono="cuenta" texto={`A pagar (${d.aPagar.length})`} detalle="Deudas que todavía no se pagaron" href="/caja/cuentas" importe={p.aPagar} m={m} signo="−" />
        <Resultado texto="Patrimonio total" importe={p.total} m={m} />
      </section>
      <Cuentas d={d} m={m} />
    </>
  );
}

function Salon({ d, m }: { d: Desglose; m: Moneda }) {
  const { p } = d;
  const c = p.conciliacion;
  const deInversores = d.autos.filter((a) => a.capitalInversor > 0);
  const consignantes = d.aPagar.filter((x) => x.c.origen === "CONSIGNANTE");
  const terceros = d.aPagar.filter((x) => x.c.origen !== "CONSIGNANTE");
  return (
    <>
      {/* Por qué Caja y Patrimonio dicen distinto "del salón": se parte de la caja y se suma lo demás. */}
      <section className="tarjeta flex flex-col">
        <h2 className="text-lg font-semibold">De la caja del salón al patrimonio del salón</h2>
        <p className="pb-2 text-sm text-suave">
          En Caja, “del salón” es solo la plata líquida. Acá se le suma lo que el salón tiene en autos y lo que le deben, y se resta lo que debe.
        </p>
        <Linea icono="salon" texto="Caja del salón" detalle="Efectivo + banco, menos lo que es de inversores y consignantes" href="/caja/saldo/salon" importe={c.cajaSalon} m={m} signo={c.cajaSalon < 0 ? "−" : "+"} />
        <Linea icono="auto" texto="Lo que el salón tiene en autos en stock" detalle="Sus autos al costo, más los gastos que les puso a los autos de los inversores" href="/patrimonio/desglose/autos" importe={c.autos} m={m} />
        <Linea icono="cuenta" texto={`A cobrar (${d.aCobrar.length})`} detalle="Créditos y saldos que todavía no entraron" href="/caja/cuentas#cobrar" importe={c.aCobrar} m={m} />
        <Linea icono="cuenta" texto={`A pagar a terceros (${terceros.length})`} detalle="Vendedores, proveedores, gastos a pagar" href="/caja/cuentas#terceros" importe={c.aPagar} m={m} signo="−" />
        <Resultado texto="Del salón" importe={p.salon} m={m} />
      </section>

      <section className="tarjeta flex flex-col">
        <h2 className="pb-2 text-lg font-semibold">Visto al revés: del total, lo que no es del salón</h2>
        <Linea icono="total" texto="Patrimonio total" href="/patrimonio/desglose/total" importe={p.total} m={m} />
        {deInversores.map((a) => (
          <Linea
            key={a.id}
            icono="auto"
            signo="−"
            texto={<>Lo que puso {a.dueno} en el <AutoEnLinea auto={a} anio /></>}
            detalle="Sigue en stock: es suyo hasta que se venda. Los gastos los puso el salón y quedan del salón."
            href={`/stock/${a.id}`}
            importe={a.capitalInversor}
            m={m}
          />
        ))}
        {d.deInversores.map((g) => (
          <Linea
            key={g.d.id}
            icono="inversor"
            signo={g.d.importe < 0 ? "+" : "−"}
            texto={`${g.d.tipo === "CAPITAL" ? "Capital a devolverle" : "Ganancia a pagarle"} a ${g.participe.nombre}`}
            detalle={<>Venta {g.numero} · <AutoEnLinea auto={g.auto} anio /></>}
            href={`/ventas/${g.operacionId}`}
            importe={g.d.importe}
            m={m}
          />
        ))}
        {deInversores.length === 0 && d.deInversores.length === 0 && <p className="border-t border-linea py-2.5 text-sm text-apagado">No hay nada de inversores.</p>}
        <Resultado texto="Del salón" importe={p.salon} m={m} />
        {consignantes.length > 0 && (
          <p className="pt-2 text-[13px] text-apagado">
            Lo que se les debe a los consignantes ({m(p.deudaConsignantes)}) ya está restado en el total, como cuenta a pagar.
          </p>
        )}
      </section>
    </>
  );
}

function Autos({ d, m, filtro }: { d: Desglose; m: Moneda; filtro: FiltroAuto }) {
  const autos = d.autos.filter((a) => coincideAuto(a, filtro));
  const filtrado = hayFiltroAuto(filtro);
  const t = (f: (a: Desglose["autos"][number]) => number) => r2(autos.reduce((s, a) => s + f(a), 0));
  const { marcas, modelos } = opcionesAuto(d.autos);
  return (
    <section className="tarjeta flex flex-col gap-2 p-0">
      {d.autos.length > 0 && (
        <FormFiltros claseBarra="mx-4" className="grid gap-3 p-4 pb-0 sm:grid-cols-3">
          <CamposFiltroAuto valores={filtro} marcas={marcas} modelos={modelos} />
        </FormFiltros>
      )}
      {d.autos.length === 0 ? (
        <p className="p-4 text-sm text-apagado">No hay autos en stock.</p>
      ) : autos.length === 0 ? (
        <p className="p-4 text-sm text-apagado">Ningún auto coincide con los filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <ThAuto />
                <th>Estado</th>
                <th>Financia</th>
                <th className="text-right">Compra</th>
                <th className="text-right">Gastos</th>
                <th className="text-right">Costo</th>
                <th className="text-right">Del inversor</th>
                <th className="text-right">Del salón</th>
              </tr>
            </thead>
            <tbody>
              {autos.map((a) => (
                <tr key={a.id}>
                  <TdAuto auto={a} href={`/stock/${a.id}`} anio />
                  <td>
                    <ChipEstado estado={a.estado} />
                  </td>
                  <td>{a.dueno}</td>
                  <td className="num text-right">{m(a.valorCompraArs)}</td>
                  <td className="num text-right">{m(a.gastos)}</td>
                  <td className="num text-right font-semibold">{m(a.costo)}</td>
                  <td className="num text-right">{a.capitalInversor ? m(a.capitalInversor) : "—"}</td>
                  <td className="num text-right">{m(a.delSalon)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={5}>{filtrado ? `Total de lo filtrado (${autos.length})` : "Total"}</td>
                <td className="num text-right">{m(t((a) => a.valorCompraArs))}</td>
                <td className="num text-right">{m(t((a) => a.gastos))}</td>
                <td className="num text-right">{m(filtrado ? t((a) => a.costo) : d.p.stock)}</td>
                <td className="num text-right">{m(filtrado ? t((a) => a.capitalInversor) : d.p.stockInversores)}</td>
                <td className="num text-right">{m(filtrado ? t((a) => a.delSalon) : d.p.stockSalon)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="px-4 pb-4 text-[13px] text-apagado">
        Costo = compra + gastos (R1). De un auto de inversor, lo suyo es el valor de compra; los gastos los pone el salón y los recupera al vender (K9, K10).
        {d.consignados > 0 && ` Hay ${d.consignados} ${d.consignados === 1 ? "auto" : "autos"} en consignación que no suman.`}
      </p>
    </section>
  );
}

function Liquido({ d, m }: { d: Desglose; m: Moneda }) {
  const { p } = d;
  return (
    <section className="tarjeta flex flex-col">
      <h2 className="pb-2 text-lg font-semibold">La cuenta</h2>
      <Linea icono="efectivo" texto="Efectivo" href="/caja/saldo/efectivo" importe={p.caja.efectivo} m={m} signo={p.caja.efectivo < 0 ? "−" : "+"} />
      <Linea icono="banco" texto="Banco" href="/caja/saldo/banco" importe={p.caja.banco} m={m} signo={p.caja.banco < 0 ? "−" : "+"} />
      <Resultado texto="Disponible en caja" importe={p.caja.total} m={m} />
      <div className="h-3" />
      {d.deInversores.map((g) => (
        <Linea
          key={g.d.id}
          icono="inversor"
          signo={g.d.importe < 0 ? "+" : "−"}
          texto={`${g.d.tipo === "CAPITAL" ? "Capital a devolverle" : "Ganancia a pagarle"} a ${g.participe.nombre}`}
          detalle={<>Venta {g.numero} · <AutoEnLinea auto={g.auto} anio /></>}
          href={`/ventas/${g.operacionId}`}
          importe={g.d.importe}
          m={m}
        />
      ))}
      {d.deInversores.length === 0 && <p className="border-t border-linea py-2.5 text-sm text-apagado">No se les debe nada a los inversores.</p>}
      <Resultado texto="Del salón" importe={p.cajaSalon} m={m} />
    </section>
  );
}

function Cuentas({ d, m }: { d: Desglose; m: Moneda }) {
  if (d.aCobrar.length + d.aPagar.length === 0) return null;
  return (
    <section className="tarjeta flex flex-col">
      <h2 className="pb-2 text-lg font-semibold">Cuentas abiertas, una por una</h2>
      {[...d.aCobrar, ...d.aPagar].map(({ c }) => (
        <Linea
          key={c.id}
          icono="cuenta"
          signo={c.tipo === "A_COBRAR" ? "+" : "−"}
          texto={`${c.tipo === "A_COBRAR" ? "Nos debe" : "Le debemos a"} ${c.contraparte}`}
          detalle={c.notas ?? undefined}
          href="/caja/cuentas"
          importe={c.saldo}
          m={m}
        />
      ))}
    </section>
  );
}
