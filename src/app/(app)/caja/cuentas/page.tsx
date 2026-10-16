import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { listarCuentas } from "@/server/caja";
import { fecha, hoyIso, pesos } from "@/lib/formato";
import { NavCaja } from "../nav";
import { FormCuenta, FormPagoCuenta } from "../formularios";

export const metadata = { title: "Cuentas pendientes · Colombia Automotores" };

const ORIGEN: Record<string, string> = {
  CREDITO_BANCARIO: "Crédito bancario",
  SALDO_COMPRA: "Saldo de compra",
  CONSIGNANTE: "Consignación",
  GASTO: "Gasto de auto",
  MANUAL: "Manual",
};

export default async function CuentasPage() {
  await requerirUsuario();
  const [aCobrar, aPagar] = await Promise.all([listarCuentas({ tipo: "A_COBRAR" }), listarCuentas({ tipo: "A_PAGAR" })]);
  const hoy = hoyIso();
  const total = (xs: typeof aCobrar) => xs.reduce((a, x) => a + x.c.saldo, 0);

  const Tabla = ({ filas, tipo }: { filas: typeof aCobrar; tipo: "A_COBRAR" | "A_PAGAR" }) =>
    filas.length === 0 ? (
      <p className="p-4 text-sm text-apagado">No hay cuentas {tipo === "A_COBRAR" ? "a cobrar" : "a pagar"}.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>{tipo === "A_COBRAR" ? "Nos debe" : "Le debemos a"}</th>
              <th>Origen</th>
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
                <td className="max-w-xs whitespace-normal text-sm">
                  {c.operacionId ? <Link href={`/ventas/${c.operacionId}`}>{c.notas}</Link> : c.notas}
                  {auto && !c.operacionId && (
                    <Link href={`/stock/${auto.id}`} className="block text-xs">
                      {auto.marca} {auto.modelo} {auto.dominio ?? ""}
                    </Link>
                  )}
                </td>
                <td className={`num ${c.vencimiento && c.vencimiento < hoy ? "font-semibold text-aviso-texto" : ""}`}>{fecha(c.vencimiento)}</td>
                <td className="num text-right">
                  {pesos(c.saldo)}
                  {c.saldo !== c.importe && <span className="block text-xs text-apagado">de {pesos(c.importe)}</span>}
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
        <p className="text-suave">Plata que no está en la caja pero cuenta para el patrimonio: créditos que el banco todavía no liquidó, deudas con vendedores, consignantes y terceros.</p>
      </header>

      <section className="tarjeta p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h2 className="text-lg font-semibold">A cobrar</h2>
          <span className="num font-semibold text-ok-texto">{pesos(total(aCobrar))}</span>
        </div>
        <Tabla filas={aCobrar} tipo="A_COBRAR" />
      </section>

      <section className="tarjeta p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h2 className="text-lg font-semibold">A pagar</h2>
          <span className="num font-semibold text-aviso-texto">{pesos(total(aPagar))}</span>
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
