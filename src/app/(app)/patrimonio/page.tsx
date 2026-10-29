import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { listarCuentas, patrimonio, subcajas } from "@/server/caja";
import { usd } from "@/lib/formato";
import { ChipEstado } from "@/components/ui";
import { TarjetaEnlace } from "@/components/tarjeta";
import { IlustracionPatrimonio, Vacio } from "@/components/ilustraciones";
import { NavPatrimonio } from "../caja/nav";

export const metadata = { title: "Patrimonio · Colombia Automotores" };

export default async function PatrimonioPage() {
  await requerirUsuario();
  const [{ m }, p, inversiones, cuentas] = await Promise.all([vistaMoneda(), patrimonio(), subcajas(), listarCuentas({})]);
  const conAutos = inversiones.filter((x) => x.autos.length);
  const aCobrar = cuentas.filter((c) => c.c.tipo === "A_COBRAR");
  const aPagar = cuentas.filter((c) => c.c.tipo === "A_PAGAR");
  const activos = Math.max(1, Math.max(0, p.caja.total) + p.stock + p.aCobrar);
  const pct = (n: number) => `${Math.max(0, (n / activos) * 100)}%`;

  // K11: de todo lo que hay, cuánto le toca a cada uno. El salón sale por resta, así que
  // incluye los gastos que les puso a los autos de los inversores.
  const porDueno = inversiones
    .filter((x) => x.participe.tipo === "INVERSOR")
    .map((x) => ({ nombre: x.participe.nombre, enAutos: x.capital, porCobrar: x.capitalPorCobrar + x.pendiente }))
    .filter((x) => x.enAutos !== 0 || x.porCobrar !== 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold">Patrimonio</h1>
          <NavPatrimonio actual="/patrimonio" />
          <p className="max-w-2xl text-suave">
            Todo lo que vale el negocio: la plata invertida en autos (al costo), lo que hay por cobrar y la caja, menos lo que se debe. Los autos de los
            inversores suman al total, pero son de ellos.
          </p>
        </div>
        <IlustracionPatrimonio className="hidden h-24 w-auto sm:block" />
      </header>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Patrimonio total</span>
          <span className="num text-3xl">{m(p.total)}</span>
          <span className="text-[13px] text-apagado">Todo lo que hay, sea de quien sea</span>
        </div>
        <div className="tarjeta flex flex-col gap-1.5 border-tinta">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Del salón</span>
          <span className={`num text-3xl ${p.salon < 0 ? "text-aviso-texto" : ""}`}>{m(p.salon)}</span>
          <span className="text-[13px] text-apagado">
            {p.total - p.salon === 0 ? "No hay plata de inversores" : `${m(p.total - p.salon)} son de los inversores`}
          </span>
        </div>
        <div className="tarjeta flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Invertido en autos</span>
          <span className="num text-3xl">{m(p.stock)}</span>
          <span className="text-[13px] text-apagado">
            {p.autosEnStock} {p.autosEnStock === 1 ? "auto" : "autos"} al costo
            {p.stockInversores > 0 && ` · ${m(p.stockInversores)} de inversores`}
          </span>
        </div>
        <TarjetaEnlace href="/caja" pie="Ver caja" className="gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Líquido (caja)</span>
          <span className={`num text-3xl ${p.caja.total < 0 ? "text-aviso-texto" : ""}`}>{m(p.caja.total)}</span>
          <span className="text-[13px] text-apagado">{p.deudaInversores > 0 ? `Del salón ${m(p.cajaSalon)}` : "Toda del salón"}</span>
        </TarjetaEnlace>
      </section>

      <section className="tarjeta flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Composición</h2>
        <div className="flex h-4 overflow-hidden rounded-full bg-linea" role="img" aria-label="Composición del patrimonio: autos, caja y cuentas a cobrar">
          <div className="bg-grafico-stock" style={{ width: pct(p.stock) }} />
          <div className="bg-ok" style={{ width: pct(Math.max(0, p.caja.total)) }} />
          <div className="bg-acento" style={{ width: pct(p.aCobrar) }} />
        </div>
        <div className="grid gap-x-8 sm:grid-cols-2">
          {[
            { c: "var(--color-grafico-stock)", t: "Autos en stock, al costo", v: p.stock },
            { c: "var(--color-grafico-caja)", t: "Caja (efectivo + banco)", v: p.caja.total },
            { c: "var(--color-grafico-cobrar)", t: "A cobrar (créditos y saldos)", v: p.aCobrar },
            { c: "", t: "A pagar (deudas, consignantes, gastos)", v: -p.aPagar },
          ].map((x) => (
            <div key={x.t} className="flex justify-between gap-3 border-t border-linea py-2 text-sm">
              <span className="flex items-center gap-2">
                {x.c && <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: x.c }} />}
                {x.t}
              </span>
              <span className={`num ${x.v < 0 ? "text-aviso-texto" : ""}`}>{m(x.v)}</span>
            </div>
          ))}
        </div>
        {p.consignados > 0 && <p className="text-xs text-apagado">{p.consignados} autos en consignación no suman: no son del salón.</p>}
      </section>

      <section className="tarjeta flex flex-col gap-1">
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-lg font-semibold">De quién es</h2>
          {porDueno.length > 0 && (
            <Link href="/patrimonio/inversores" className="text-sm font-semibold">
              Ver inversores →
            </Link>
          )}
        </div>
        <div className="flex justify-between gap-3 border-t border-linea py-2 text-sm">
          <span className="font-semibold">Salón</span>
          <span className="num font-semibold">{m(p.salon)}</span>
        </div>
        {porDueno.map((x) => (
          <div key={x.nombre} className="flex flex-wrap justify-between gap-3 border-t border-linea py-2 text-sm">
            <span>
              {x.nombre}
              <span className="text-apagado">
                {" · "}
                {x.enAutos > 0 && `${m(x.enAutos)} en autos`}
                {x.enAutos > 0 && x.porCobrar !== 0 && " · "}
                {x.porCobrar !== 0 && `${m(x.porCobrar)} por cobrar`}
              </span>
            </span>
            <span className="num">{m(x.enAutos + x.porCobrar)}</span>
          </div>
        ))}
        {porDueno.length === 0 && <p className="border-t border-linea py-2 text-sm text-apagado">Todo el patrimonio es del salón: no hay autos ni plata de inversores.</p>}
      </section>

      <section className="tarjeta flex flex-col p-0">
        <h2 className="p-4 pb-2 text-lg font-semibold">Plata invertida en autos</h2>
        {conAutos.length === 0 ? (
          <Vacio>No hay autos en stock.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Auto</th>
                  <th>Estado</th>
                  <th>Financia</th>
                  <th className="text-right">Invertido</th>
                  <th className="text-right">En USD (dólar de compra)</th>
                </tr>
              </thead>
              <tbody>
                {conAutos.flatMap((x) =>
                  x.autos.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/stock/${a.id}`} className="text-tinta">
                          {a.marca} {a.modelo} {a.anio} <span className="num text-apagado">{a.dominio}</span>
                        </Link>
                      </td>
                      <td>
                        <ChipEstado estado={a.estado} />
                      </td>
                      <td>{x.participe.nombre}</td>
                      <td className="num text-right">{m(a.invertido)}</td>
                      <td className="num text-right text-apagado">{usd(a.invertido / a.tcIngreso)}</td>
                    </tr>
                  )),
                )}
              </tbody>
              <tfoot>
                {conAutos.map((x) => (
                  <tr key={x.participe.id}>
                    <td colSpan={3} className="font-semibold">
                      {x.participe.tipo === "SALON" ? "Fondos propios del salón" : `Puesto por ${x.participe.nombre}`}
                    </td>
                    <td className="num text-right font-semibold">{m(x.capital)}</td>
                    <td className="num text-right text-apagado">{usd(x.capitalUsd)}</td>
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        )}
        {p.stockInversores > 0 && (
          <p className="px-4 pb-4 text-xs text-apagado">
            De los autos de inversores se cuenta lo que puso cada uno (el valor de compra). Los gastos los pone el salón y los recupera al vender.
          </p>
        )}
      </section>

      {(aCobrar.length > 0 || aPagar.length > 0) && (
        <section className="tarjeta flex flex-col">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-lg font-semibold">Cuentas abiertas</h2>
            <Link href="/caja/cuentas" className="text-sm font-semibold">
              Gestionar →
            </Link>
          </div>
          {[...aCobrar, ...aPagar].map(({ c }) => (
            <div key={c.id} className="flex justify-between gap-3 border-t border-linea py-2 text-sm">
              <span>
                {c.tipo === "A_COBRAR" ? "Nos debe" : "Le debemos a"} <b>{c.contraparte}</b>
                {c.notas && <span className="text-apagado"> · {c.notas}</span>}
              </span>
              <span className={`num ${c.tipo === "A_PAGAR" ? "text-aviso-texto" : "text-ok-texto"}`}>{m(c.tipo === "A_PAGAR" ? -c.saldo : c.saldo)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
