import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { subcajas } from "@/server/caja";
import { usd } from "@/lib/formato";
import { ChipEstado, Ayuda } from "@/components/ui";
import { NavPatrimonio } from "../../caja/nav";

export const metadata = { title: "Inversores · Colombia Automotores" };

export default async function InversoresPage() {
  await requerirUsuario();
  const [{ m }, filas] = await Promise.all([vistaMoneda(), subcajas()]);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Inversores</h1>
        <NavPatrimonio actual="/patrimonio/inversores" />
        <p className="text-suave">
          Lo que cada uno puso en autos hoy, lo que se le debe de ventas ya cerradas y cuánto ganó. El salón aparece con los autos comprados con fondos
          propios.
        </p>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        {filas.map((f) => (
          <section key={f.participe.id} className="tarjeta flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">{f.participe.nombre}</h2>
              <span className="text-sm text-apagado">{f.participe.tipo === "SALON" ? "Fondos propios" : "Inversor"}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-apagado">
                  Puesto en autos
                  <Ayuda>Lo que pagó por los autos que siguen en stock (el valor de compra). Los gastos de esos autos los pone el salón.</Ayuda>
                </div>
                <div className="num text-xl">{m(f.capital)}</div>
                <div className="num text-xs text-apagado">{usd(f.capitalUsd)} al dólar de compra</div>
              </div>
              {/* K10: capital de autos ya vendidos que todavía no se le devolvió. */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-apagado">
                  Capital por cobrar
                  <Ayuda>De los autos ya vendidos, lo que puso y todavía no se le devolvió. Se paga desde Caja y no cuenta como ganancia.</Ayuda>
                </div>
                <div className={`num text-xl ${f.capitalPorCobrar ? "text-aviso-texto" : ""}`}>{m(f.capitalPorCobrar)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Ganancia por cobrar</div>
                <div className={`num text-xl ${f.pendiente ? "text-aviso-texto" : ""}`}>{m(f.pendiente)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Ganancia cobrada</div>
                <div className="num text-xl text-ok-texto">{m(f.cobrado)}</div>
              </div>
            </div>
            <div className="flex flex-col">
              {f.autos.length === 0 && <p className="text-sm text-apagado">Sin autos en stock.</p>}
              {f.autos.map((a) => (
                <Link key={a.id} href={`/stock/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-linea py-2 text-sm text-tinta">
                  <span>
                    {a.marca} {a.modelo} {a.anio} <span className="num text-apagado">{a.dominio}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <ChipEstado estado={a.estado} />
                    <span className="num">{m(a.invertido)}</span>
                  </span>
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              {(f.pendiente !== 0 || f.capitalPorCobrar !== 0) && <Link href="/caja">Pagar lo pendiente →</Link>}
              <Link href="/reportes">Ganancias pagadas por mes →</Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
