import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { listarCuentas, pendientesPorPagar } from "@/server/caja";
import { fecha, hoyIso } from "@/lib/formato";
import { NavCaja } from "../nav";
import { FormCuenta, FormPagarGanancia, FormPagoCuenta } from "../formularios";
import { Ayuda } from "@/components/ui";
import { Icono } from "@/components/iconos-caja";
import { FormFiltros } from "@/components/filtros";
import { AutoEnLinea, CamposFiltroAuto, TdAuto, ThAuto } from "@/components/auto";
import { coincideAuto, hayFiltroAuto, leerFiltroAuto, opcionesAuto } from "@/domain/autos";

export const metadata = { title: "Cuentas pendientes · Colombia Automotores" };

const ORIGEN: Record<string, string> = {
  CREDITO_BANCARIO: "Crédito bancario",
  SALDO_COMPRA: "Saldo de compra",
  CONSIGNANTE: "Consignación",
  GASTO: "Gasto de auto",
  MANUAL: "Manual",
};

export default async function CuentasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requerirUsuario();
  const { m } = await vistaMoneda();
  const filtro = leerFiltroAuto(await searchParams);
  const [cobrarTodas, pagarTodas, inversoresTodos] = await Promise.all([listarCuentas({ tipo: "A_COBRAR" }), listarCuentas({ tipo: "A_PAGAR" }), pendientesPorPagar()]);
  // Filtro por auto: las cuentas que no son de un auto (ej. una deuda del salón) solo se ven sin filtro.
  const aCobrar = cobrarTodas.filter((x) => coincideAuto(x.auto, filtro));
  const aPagarTodo = pagarTodas.filter((x) => coincideAuto(x.auto, filtro));
  // Los dueños de autos en consignación van aparte, como los inversores: esa plata ya está en la caja.
  const aConsignantes = aPagarTodo.filter((x) => x.c.origen === "CONSIGNANTE");
  const aPagar = aPagarTodo.filter((x) => x.c.origen !== "CONSIGNANTE");
  const inversores = inversoresTodos.filter((g) => coincideAuto(g.auto, filtro));
  const { marcas, modelos } = opcionesAuto([...[...cobrarTodas, ...pagarTodas].map((x) => x.auto), ...inversoresTodos.map((g) => g.auto)]);
  const totalInversores = inversores.reduce((a, g) => a + g.d.importe, 0);
  const hoy = hoyIso();
  const total = (xs: typeof aCobrar) => xs.reduce((a, x) => a + x.c.saldo, 0);

  const Tabla = ({ filas, tipo }: { filas: typeof aCobrar; tipo: "A_COBRAR" | "A_PAGAR" }) =>
    filas.length === 0 ? (
      <p className="p-4 text-sm text-apagado">No hay cuentas {tipo === "A_COBRAR" ? "a cobrar" : "a pagar"}.</p>
    ) : (
      <div className="relative overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>{tipo === "A_COBRAR" ? "Nos debe" : "Le debemos a"}</th>
              <th>Origen</th>
              <ThAuto />
              <th>Detalle</th>
              <th>Vence</th>
              <th className="text-right">Saldo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map(({ c, auto }) => (
              <tr key={c.id}>
                <td className="font-semibold">{c.contraparte}</td>
                <td>{ORIGEN[c.origen]}</td>
                <TdAuto auto={auto?.id ? auto : null} href={auto?.id ? `/stock/${auto.id}` : undefined} />
                <td className="max-w-xs whitespace-normal text-sm">
                  {c.operacionId ? <Link href={`/ventas/${c.operacionId}`}>{c.notas}</Link> : c.notas}
                </td>
                <td className={`num ${c.vencimiento && c.vencimiento < hoy ? "font-semibold text-aviso-texto" : ""}`}>{fecha(c.vencimiento)}</td>
                <td className="num text-right">
                  {m(c.saldo)}
                  {c.saldo !== c.importe && <span className="block text-xs text-apagado">de {m(c.importe)}</span>}
                </td>
                <td>
                  <FormPagoCuenta id={c.id} saldo={c.saldo} tipo={c.tipo} deVenta={c.origen === "CREDITO_BANCARIO" || (c.origen === "MANUAL" && c.operacionId != null)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Cuentas pendientes</h1>
        <NavCaja actual="/caja/cuentas" />
        <p className="max-w-3xl text-suave">
          Todo lo que todavía hay que cobrar o pagar, en un solo lugar: lo que nos deben (créditos que el banco no liquidó, saldos de clientes), lo que les
          debemos a terceros (vendedores, consignantes, proveedores) y lo que les debemos a los inversores por sus autos ya vendidos.
        </p>
      </header>

      <FormFiltros plegable className="tarjeta grid gap-3.5 p-4 sm:grid-cols-3">
        <CamposFiltroAuto valores={filtro} marcas={marcas} modelos={modelos} />
      </FormFiltros>
      {hayFiltroAuto(filtro) && <p className="-mt-2 text-sm text-apagado">Los totales de abajo son solo de los autos filtrados.</p>}

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { t: "A cobrar", v: total(aCobrar), href: "#cobrar", tono: "ok" as const, pie: "Entra a la caja cuando se cobra", icono: "cuenta" as const },
          { t: "A pagar a inversores", v: totalInversores, href: "#inversores", tono: "aviso" as const, pie: "Ya está en la caja, pero es de ellos", icono: "inversor" as const },
          { t: "A pagar a consignantes", v: total(aConsignantes), href: "#consignantes", tono: "aviso" as const, pie: "Ya está en la caja, pero es de los dueños", icono: "persona" as const },
          { t: "A pagar a terceros", v: total(aPagar), href: "#terceros", tono: "aviso" as const, pie: "Sale de la caja cuando se paga", icono: "cuenta" as const },
        ].map((x) => (
          <a key={x.t} href={x.href} className="tarjeta flex flex-col gap-1.5 text-tinta no-underline transition-colors hover:border-tinta">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-apagado">
              <span className={`inline-flex size-8 items-center justify-center rounded-lg ${x.tono === "ok" ? "bg-ok-fondo text-ok-texto" : "bg-aviso-fondo text-aviso-texto"}`}>
                <Icono nombre={x.icono} className="size-[18px]" />
              </span>
              {x.t}
            </span>
            <span className="num text-3xl">{m(x.v)}</span>
            <span className="text-[13px] text-apagado">{x.pie}</span>
          </a>
        ))}
      </section>

      <section id="cobrar" className="tarjeta scroll-mt-4 p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h2 className="text-lg font-semibold">A cobrar</h2>
          <span className="num font-semibold text-ok-texto">{m(total(aCobrar))}</span>
        </div>
        <Tabla filas={aCobrar} tipo="A_COBRAR" />
      </section>

      <section id="inversores" className="tarjeta flex scroll-mt-4 flex-col p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h2 className="text-lg font-semibold">
            A pagar a inversores por autos vendidos
            <Ayuda>
              Al cerrar la venta de un auto de un inversor entra toda la plata a la caja, pero una parte es de él: lo que puso para comprarlo (su capital, que
              no es ganancia) y su parte de la ganancia. Hasta que se le paga, está en la caja pero no es del salón. La parte del salón no figura acá: queda
              directo en su caja (K5).
            </Ayuda>
          </h2>
          <span className="num font-semibold text-aviso-texto">{m(totalInversores)}</span>
        </div>
        {inversores.length === 0 && <p className="p-4 pt-0 text-sm text-apagado">No se les debe nada a los inversores.</p>}
        {inversores.map((g) => (
          <div key={g.d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linea px-4 py-2.5 text-sm">
            <span className="flex min-w-48 items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-aviso-fondo text-aviso-texto">
                <Icono nombre="inversor" className="size-4" />
              </span>
              <span>
                <b>{g.participe.nombre}</b> · {g.d.tipo === "CAPITAL" ? "devolución de capital" : "su ganancia"}
                <span className="block text-apagado">
                  Venta{" "}
                  <Link href={`/ventas/${g.operacionId}`} className="num">
                    {g.numero}
                  </Link>{" "}
                  {g.fechaCierre && ` · cerrada el ${fecha(g.fechaCierre)}`}
                  <span className="mt-1 block text-tinta">
                    <AutoEnLinea auto={g.auto} anio />
                  </span>
                </span>
              </span>
            </span>
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className={`num font-semibold ${g.d.importe < 0 ? "text-ok-texto" : ""}`}>{m(g.d.importe)}</span>
              <FormPagarGanancia id={g.d.id} importe={g.d.importe} capital={g.d.tipo === "CAPITAL"} etiqueta={g.d.tipo === "CAPITAL" ? "Devolver" : "Pagar"} />
            </span>
          </div>
        ))}
      </section>

      <section id="consignantes" className="tarjeta scroll-mt-4 p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h2 className="text-lg font-semibold">
            A pagar a consignantes por autos vendidos
            <Ayuda>
              Al vender un auto en consignación entra todo el precio a la caja, pero lo que pidió el dueño es de él. Lo que se sacó arriba es del salón.
              Ver todos los consignados en <Link href="/patrimonio/consignaciones">Patrimonio → Consignaciones</Link>.
            </Ayuda>
          </h2>
          <span className="num font-semibold text-aviso-texto">{m(total(aConsignantes))}</span>
        </div>
        <Tabla filas={aConsignantes} tipo="A_PAGAR" />
      </section>

      <section id="terceros" className="tarjeta scroll-mt-4 p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h2 className="text-lg font-semibold">A pagar a terceros</h2>
          <span className="num font-semibold text-aviso-texto">{m(total(aPagar))}</span>
        </div>
        <Tabla filas={aPagar} tipo="A_PAGAR" />
      </section>

      <details className="tarjeta">
        <summary className="cursor-pointer text-lg font-semibold">+ Registrar deuda o crédito con un tercero</summary>
        <p className="mb-3 mt-1 text-sm text-apagado">Para cargar lo que hoy está anotado aparte (por ejemplo, lo que se le debe a Arias).</p>
        <FormCuenta />
      </details>
    </div>
  );
}
