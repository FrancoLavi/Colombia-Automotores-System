import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { subcajas } from "@/server/caja";
import { pesos, usd } from "@/lib/formato";
import { ChipEstado } from "@/components/ui";
import { NavCaja } from "../nav";

export const metadata = { title: "Inversores · Colombia Automotores" };

export default async function InversoresPage() {
  await requerirUsuario();
  const filas = await subcajas();
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Inversores</h1>
        <NavCaja actual="/caja/inversores" />
        <p className="text-suave">Lo que cada uno tiene invertido en autos hoy y cuánto ganó. El salón aparece con los autos comprados con fondos propios.</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        {filas.map((f) => (
          <section key={f.participe.id} className="tarjeta flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">{f.participe.nombre}</h2>
              <span className="text-sm text-apagado">{f.participe.tipo === "SALON" ? "Fondos propios" : "Inversor"}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Invertido en autos</div>
                <div className="num text-xl">{pesos(f.capital)}</div>
                <div className="num text-xs text-apagado">{usd(f.capitalUsd)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Ganancia por cobrar</div>
                <div className={`num text-xl ${f.pendiente ? "text-aviso-texto" : ""}`}>{pesos(f.pendiente)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Ganancia cobrada</div>
                <div className="num text-xl text-ok-texto">{pesos(f.cobrado)}</div>
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
                    <span className="num">{pesos(a.costo)}</span>
                  </span>
                </Link>
              ))}
            </div>
            {f.pendiente !== 0 && (
              <Link href="/caja" className="text-sm font-semibold">
                Pagar ganancias pendientes →
              </Link>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
