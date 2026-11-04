import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { consignaciones } from "@/server/caja";
import { fecha, nombreContacto } from "@/lib/formato";
import { ChipEstado, Ayuda } from "@/components/ui";
import { TdAuto, ThAuto } from "@/components/auto";
import { Icono } from "@/components/iconos-caja";
import { Vacio } from "@/components/ilustraciones";
import { NavPatrimonio } from "../../caja/nav";
import { FormPagoCuenta } from "../../caja/formularios";

export const metadata = { title: "Consignaciones · Colombia Automotores" };

export default async function ConsignacionesPage() {
  await requerirUsuario();
  const [{ m }, c] = await Promise.all([vistaMoneda(), consignaciones()]);
  const t = c.totales;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Consignaciones</h1>
        <NavPatrimonio actual="/patrimonio/consignaciones" />
        <p className="max-w-3xl text-suave">
          Autos que dejan clientes para que los vendamos. El dueño pide un monto por su auto; cuando se vende se le paga eso y{" "}
          <b>todo lo que se saque arriba es del salón</b>. No son inversores: no ponen plata ni cobran ganancia. El auto no suma al patrimonio porque no es
          del salón.
        </p>
      </header>

      {/* Cómo funciona, en un dibujo de tres pasos. */}
      <ol className="grid gap-3 sm:grid-cols-3" aria-label="Cómo funciona una consignación">
        {[
          { icono: "persona" as const, t: "1. El dueño deja el auto", d: "Se carga en Stock → Ingresar auto → Consignación, con lo que pide." },
          { icono: "venta" as const, t: "2. Se vende", d: "El precio se cobra entero en la caja. Al dueño se le debe lo que pidió." },
          { icono: "salon" as const, t: "3. Se le paga al dueño", d: "Lo que se sacó arriba, menos los gastos, es ganancia del salón." },
        ].map((p) => (
          <li key={p.t} className="flex items-start gap-3 rounded-2xl bg-panel p-4">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-superficie text-acento">
              <Icono nombre={p.icono} />
            </span>
            <span>
              <b>{p.t}</b>
              <span className="block text-sm text-suave">{p.d}</span>
            </span>
          </li>
        ))}
      </ol>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <div className="tarjeta flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">En stock</span>
          <span className="num text-3xl">{t.enStock}</span>
          <span className="text-[13px] text-apagado">Los dueños piden {m(t.pedidoEnStock)} · al salón le quedarían {m(t.paraElSalonEnStock)}</span>
        </div>
        <Link href="/caja/cuentas#consignantes" className="tarjeta flex flex-col gap-1 text-tinta no-underline hover:border-tinta">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">
            Se les debe
            <Ayuda>Autos ya vendidos que todavía no se les pagaron a sus dueños. Esa plata está en la caja pero no es del salón.</Ayuda>
          </span>
          <span className={`num text-3xl ${t.seLesDebe ? "text-aviso-texto" : ""}`}>{m(t.seLesDebe)}</span>
          <span className="text-[13px] text-apagado">Se paga desde Cuentas pendientes →</span>
        </Link>
        <div className="tarjeta flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Ganó el salón</span>
          <span className="num text-3xl text-ok-texto">{m(t.ganadoConVendidos)}</span>
          <span className="text-[13px] text-apagado">Con los consignados ya vendidos</span>
        </div>
      </section>

      {c.grupos.length === 0 && (
        <section className="tarjeta">
          <Vacio>
            No hay autos en consignación. Se cargan en <Link href="/stock/nuevo">Stock → Ingresar auto</Link> eligiendo “Consignación”.
          </Vacio>
        </section>
      )}

      {c.grupos.map((g) => (
        <section key={g.dueno?.id ?? "sin"} className="tarjeta flex min-w-0 flex-col gap-2 p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-info-fondo text-info-texto">
                <Icono nombre="persona" className="size-4" />
              </span>
              {g.dueno ? <Link href={`/contactos/${g.dueno.id}`} className="text-tinta">{nombreContacto(g.dueno)}</Link> : "Dueño sin cargar"}
            </h2>
            <span className="text-sm text-apagado">
              {g.filas.length} {g.filas.length === 1 ? "auto" : "autos"}
            </span>
          </div>
          <div className="relative overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <ThAuto />
                  <th>Estado</th>
                  <th className="text-right">Pide el dueño</th>
                  <th className="text-right">Gastos</th>
                  <th className="text-right">Precio</th>
                  <th className="text-right">Para el salón</th>
                  <th>Pago al dueño</th>
                </tr>
              </thead>
              <tbody>
                {g.filas.map((f) => (
                  <tr key={f.auto.id}>
                    <TdAuto auto={f.auto} href={`/stock/${f.auto.id}`} anio />
                    <td>
                      <ChipEstado estado={f.auto.estado} />
                    </td>
                    <td className="num text-right">{m(f.pide)}</td>
                    <td className="num text-right">{f.gastos ? m(f.gastos) : "—"}</td>
                    <td className="num text-right">
                      {m(f.precio)}
                      <span className="block text-xs text-apagado">
                        {f.venta ? (
                          <Link href={`/ventas/${f.venta.operacionId}`}>
                            vendido {f.venta.numero} · {fecha(f.venta.fechaCierre)}
                          </Link>
                        ) : (
                          "publicado"
                        )}
                      </span>
                    </td>
                    <td className={`num text-right font-semibold ${f.paraElSalon < 0 ? "text-aviso-texto" : "text-ok-texto"}`}>{m(f.paraElSalon)}</td>
                    <td>
                      {!f.venta ? (
                        <span className="text-sm text-apagado">Se paga al vender</span>
                      ) : f.cuentaId ? (
                        <span className="flex flex-col gap-1">
                          <span className="num text-sm font-semibold text-aviso-texto">Se le debe {m(f.seLeDebe)}</span>
                          <FormPagoCuenta id={f.cuentaId} saldo={f.seLeDebe} tipo="A_PAGAR" deVenta={false} />
                        </span>
                      ) : (
                        <span className="chip bg-ok-fondo text-ok-texto">Pagado {m(f.pagado)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
