import type { Metadata } from "next";
import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { tesoreria } from "@/server/valores";
import { fecha, pesos } from "@/lib/formato";
import { ETIQUETA_ESTADO, ETIQUETA_VALOR, type Alarma } from "@/domain/valores";
import { numeroOperacion } from "@/domain/ventas";
import { AccionesValor, FormNuevoValor } from "./formularios";

export const metadata: Metadata = { title: "Tesorería" };

const CHIP_ALARMA: Record<Alarma, { texto: string; clase: string } | null> = {
  AL_DIA: null,
  POR_VENCER: { texto: "Vence pronto", clase: "bg-aviso-fondo text-aviso-texto" },
  VENCIDO: { texto: "Vencido", clase: "bg-aviso-texto text-white" },
  RECHAZADO: { texto: "Rebotó", clase: "bg-aviso-texto text-white" },
};

export default async function TesoreriaPage() {
  await requerirUsuario();
  const { valores, resumen, aPagar } = await tesoreria();
  const deudas = aPagar.map((c) => ({ id: c.id, contraparte: c.contraparte, saldo: c.saldo }));
  const vivos = valores.filter((v) => v.estado === "EN_CARTERA" || v.estado === "DEPOSITADO" || v.estado === "RECHAZADO");
  const cerrados = valores.filter((v) => !vivos.includes(v));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Tesorería</h1>
        <p className="text-suave max-md:hidden">
          Los cheques y pagarés que recibimos. Mientras están en cartera son plata <b>a cobrar</b>, no plata en la caja:
          entran a la caja recién cuando el banco los acredita.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <Tarjeta titulo="En cartera" valor={resumen.enCartera} detalle="Todavía no se depositaron" />
        <Tarjeta titulo="Depositados" valor={resumen.depositados} detalle="Esperando que acrediten" />
        <Tarjeta titulo="Rebotados" valor={resumen.rechazados} detalle="Se le reclama al librador" alerta={resumen.rechazados > 0} />
        <Tarjeta titulo="Total por cobrar" valor={resumen.total} detalle="Lo que vale la cartera hoy" />
      </div>

      {resumen.vencidos > 0 && (
        <p className="rounded-lg bg-aviso-fondo p-3 text-sm text-aviso-texto">
          Hay {pesos(resumen.vencidos)} en valores <b>vencidos</b>: se pasó el plazo para presentarlos al banco. Siguen
          valiendo, pero hay que pedirle otro al librador o reclamárselo.
        </p>
      )}

      <FormNuevoValor />

      <section className="tarjeta p-0 md:overflow-x-auto">
        <table className="tabla-tarjetas w-full text-sm">
          <thead>
            <tr className="border-b border-linea text-left text-[13px] text-suave">
              <th className="p-3">Valor</th>
              <th className="p-3">De quién</th>
              <th className="p-3">Paga el</th>
              <th className="p-3">Vence</th>
              <th className="p-3 text-right">Importe</th>
              <th className="p-3">Estado</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {vivos.length === 0 && (
              <tr>
                <td colSpan={7} className="p-5 text-center text-apagado">
                  No hay cheques en cartera.
                </td>
              </tr>
            )}
            {vivos.map((v) => {
              const chip = CHIP_ALARMA[v.alarma];
              return (
                <tr key={v.id} className="border-b border-linea align-top">
                  <td className="p-3 max-md:order-1 max-md:p-0">
                    <div className="font-medium">
                      {ETIQUETA_VALOR[v.tipo]} {v.numero ? `N° ${v.numero}` : ""}
                    </div>
                    {v.banco && <div className="text-[13px] text-suave">{v.banco}</div>}
                    {v.operacionId && (
                      <Link href={`/ventas/${v.operacionId}`} className="text-[13px]">
                        {numeroOperacion(v.operacionId)}
                      </Link>
                    )}
                  </td>
                  <td className="p-3 max-md:order-3 max-md:basis-full max-md:p-0">
                    <div>{v.deQuien}</div>
                    {v.libradorCuit && <div className="text-[13px] text-suave">{v.libradorCuit}</div>}
                  </td>
                  <td className="num p-3 max-md:order-4 max-md:p-0 max-md:text-xs" data-etiqueta="Paga el">{fecha(v.fechaPago)}</td>
                  <td className="num p-3 max-md:order-4 max-md:p-0 max-md:text-xs" data-etiqueta="Vence">{fecha(v.vence)}</td>
                  <td className="num p-3 text-right font-medium max-md:order-2 max-md:ml-auto max-md:p-0 max-md:font-semibold">{pesos(v.importe)}</td>
                  <td className="p-3 max-md:order-4 max-md:basis-full max-md:p-0">
                    <div className="flex flex-col items-start gap-1 max-md:flex-row max-md:flex-wrap">
                      <span className="chip border border-borde bg-superficie">{ETIQUETA_ESTADO[v.estado]}</span>
                      {chip && <span className={`chip ${chip.clase}`}>{chip.texto}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-right max-md:order-5 max-md:basis-full max-md:p-0 max-md:text-left">
                    <AccionesValor
                      id={v.id}
                      estado={v.estado}
                      depositable={v.depositable}
                      sinCuenta={v.sinCuenta}
                      importe={v.importe}
                      deudas={deudas}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {cerrados.length > 0 && (
        <section className="tarjeta flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Ya resueltos</h2>
          <p className="text-sm text-suave">Su plata ya se cobró, se usó para pagar una deuda, o se dio por perdida.</p>
          <ul className="flex flex-col divide-y divide-linea text-sm">
            {cerrados.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {ETIQUETA_VALOR[v.tipo]} {v.numero ? `N° ${v.numero}` : ""} · {v.deQuien}
                  {v.endosadoA && <span className="text-suave"> → endosado a {v.endosadoA}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="num">{pesos(v.importe)}</span>
                  <span className={`chip ${v.estado === "INCOBRABLE" ? "bg-aviso-fondo text-aviso-texto" : "border border-borde bg-superficie"}`}>
                    {ETIQUETA_ESTADO[v.estado]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, detalle, alerta = false }: { titulo: string; valor: number; detalle: string; alerta?: boolean }) {
  return (
    <div className={`tarjeta flex flex-col gap-1 max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:justify-between max-sm:py-3 ${alerta && valor > 0 ? "border-aviso-texto" : ""}`}>
      <span className="text-[13px] uppercase tracking-wide text-suave">{titulo}</span>
      <span className="num text-xl font-semibold sm:text-2xl">{pesos(valor)}</span>
      <span className="text-[13px] text-apagado max-sm:hidden">{detalle}</span>
    </div>
  );
}
