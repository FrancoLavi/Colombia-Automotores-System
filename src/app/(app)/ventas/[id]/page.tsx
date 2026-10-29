import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { fichaOperacion } from "@/server/ventas";
import { datosFormulario } from "@/server/vehiculos";
import { nombreContacto, fecha, porcentaje, usd } from "@/lib/formato";
import { ETIQUETA_PAGO, ABIERTAS, CONCEPTOS_GASTO_VENTA, numeroOperacion } from "@/domain/ventas";
import { alarmaEntrega, diaArgentina, horaArgentina } from "@/domain/entregas";
import { capitalDelInversor } from "@/domain/caja";
import { Ayuda, BotonQuitar, ChipAlerta, ChipEstado } from "@/components/ui";
import { Telefono } from "../../contactos/chips";
import { ChipOperacion } from "../chip";
import { quitarGastoVentaAccion, quitarPagoAccion } from "../actions";
import { FormCaer, FormCerrar, FormCobrar, FormEntregar, FormGastoVenta, FormPago, FormPermuta, FormPrecio, FormProgramarEntrega } from "./formularios";

const IMPACTO: Record<string, string> = {
  SENIA: "Caja",
  EFECTIVO: "Caja",
  TRANSFERENCIA: "Caja (banco)",
  OTRO: "Caja",
  CREDITO: "A cobrar",
  PERMUTA: "Stock (patrimonio)",
};
const ESTADO_PAGO: Record<string, { texto: string; clase: string }> = {
  COBRADO: { texto: "Cobrado", clase: "bg-ok-fondo text-ok-texto" },
  PENDIENTE: { texto: "A cobrar", clase: "bg-neutro-fondo text-neutro-texto" },
  DEVUELTA: { texto: "Devuelto", clase: "bg-error-fondo text-error-texto" },
  RETENIDA: { texto: "Retenida", clase: "bg-info-fondo text-info-texto" },
};

function Fila({ etiqueta, valor, fuerte }: { etiqueta: React.ReactNode; valor: React.ReactNode; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 border-t border-linea py-2 text-sm ${fuerte ? "font-semibold" : ""}`}>
      <span>{etiqueta}</span>
      <span className="num text-right">{valor}</span>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Venta ${numeroOperacion(Number((await params).id))} · Colombia Automotores` };
}

export default async function OperacionPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { m } = await vistaMoneda();
  const id = Number((await params).id);
  const f = await fichaOperacion(id);
  if (!f) notFound();
  const { participes } = await datosFormulario();
  const { op, v, contacto: c } = f;
  const abierta = ABIERTAS.includes(op.estado);
  const haySena = f.pagos.some((x) => x.p.tipo === "SENIA" && x.p.estado === "COBRADO");
  const pendientes = f.pagos.filter((x) => x.p.estado === "PENDIENTE" && x.p.tipo !== "PERMUTA");
  const aCobrar = pendientes.reduce((s, x) => s + x.p.importe, 0);
  const l = f.liquidacion ?? f.prevista;
  // K10: al cerrar, al inversor se le devuelve el capital que puso además de su parte (R3).
  const capital = capitalDelInversor({ tipoIngreso: v.tipoIngreso, financista: f.financista?.tipo ?? "SALON", valorCompraArs: v.valorCompraArs });
  const pctCaja = f.total ? (f.cobertura.caja / f.total) * 100 : 0;
  const pctCobrar = f.total ? (f.cobertura.aCobrar / f.total) * 100 : 0;
  const pctPermuta = f.total ? (f.cobertura.permuta / f.total) * 100 : 0;
  const alarma = alarmaEntrega(op.entregaProgramada, {
    estadoOperacion: op.estado,
    faltaCubrir: abierta ? f.cobertura.faltante : 0,
    aCobrar,
    papelesFaltantes: 0,
    estadoAuto: v.estado,
  });
  const pasos = [
    { titulo: "Preventa", hecho: true, detalle: fecha(op.fechaPreventa) },
    { titulo: "Señada", hecho: op.estado !== "PREVENTA" && haySena, detalle: haySena ? "con seña" : "sin seña" },
    { titulo: "Cerrada", hecho: op.estado === "CERRADA" || op.estado === "ENTREGADA", detalle: op.fechaCierre ? fecha(op.fechaCierre) : "pagos = total" },
    {
      titulo: "Entregada",
      hecho: op.estado === "ENTREGADA",
      detalle: op.fechaEntrega
        ? `${fecha(diaArgentina(op.fechaEntrega))} ${horaArgentina(op.fechaEntrega)}`
        : op.entregaProgramada
          ? `programada ${fecha(diaArgentina(op.entregaProgramada))} ${horaArgentina(op.entregaProgramada)}`
          : "fecha y hora",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/ventas" className="text-sm font-semibold">
        ← Volver a ventas
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="num text-apagado">
            Operación {f.numero} · abierta el {fecha(op.fechaPreventa)}
          </span>
          <h1 className="text-3xl font-bold">
            Venta a {nombreContacto(c)}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {op.estado !== "CAIDA" && (
            <a href={`/ventas/${id}/preventa`} target="_blank" rel="noreferrer" className="btn-secundario">
              Preventa en PDF
            </a>
          )}
          <ChipOperacion estado={op.estado} />
        </div>
      </header>

      {op.estado === "CAIDA" ? (
        <p className="tarjeta bg-error-fondo">
          <b>Operación caída:</b> {op.motivoCaida}
        </p>
      ) : (
        <ol className="tarjeta flex flex-wrap gap-4" aria-label="Etapas">
          {pasos.map((p) => (
            <li key={p.titulo} className="flex min-w-32 flex-1 flex-col gap-1.5 text-sm">
              <div className={`h-1.5 rounded-full ${p.hecho ? "bg-ok" : "bg-borde"}`} />
              <b className={p.hecho ? "" : "text-apagado"}>{p.titulo}</b>
              <span className="text-apagado">{p.detalle}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta flex flex-col">
          <h2 className="pb-2 text-lg font-semibold">Cliente</h2>
          <Fila etiqueta="Nombre" valor={<Link href={`/contactos/${c.id}`}>{nombreContacto(c)}</Link>} />
          <Fila etiqueta="Teléfono" valor={<Telefono telefono={c.telefono} />} />
          {c.calificacionMonto && <Fila etiqueta="Calificación" valor={`${m(c.calificacionMonto)}${c.calificacionBanco ? ` · ${c.calificacionBanco}` : ""}`} />}
        </section>
        <section className="tarjeta flex flex-col">
          <h2 className="pb-2 text-lg font-semibold">Auto que compra</h2>
          <Fila etiqueta="Auto" valor={<Link href={`/stock/${v.id}`}>{`${v.marca} ${v.modelo} ${v.anio} ${v.dominio ?? ""}`}</Link>} />
          <Fila etiqueta="Estado" valor={<ChipEstado estado={v.estado} />} />
          <Fila etiqueta="Financia" valor={f.financista?.nombre} />
          <Fila etiqueta="Precio de venta" valor={m(op.precioVenta)} fuerte />
          {abierta && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-acento">Cambiar precio u observaciones</summary>
              <div className="mt-2">
                <FormPrecio key={`${op.precioVenta}|${op.observaciones}`} id={id} precio={op.precioVenta} observaciones={op.observaciones} />
              </div>
            </details>
          )}
          {op.observaciones && <p className="mt-2 text-sm text-suave">{op.observaciones}</p>}
        </section>
      </div>

      {(abierta || f.gastosVenta.length > 0) && (
        <section className="tarjeta flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
            <h2 className="text-lg font-semibold">Total de la operación</h2>
            <span className="text-sm text-apagado">Los gastos se suman a lo que paga el cliente; no cambian el costo ni la ganancia del auto.</span>
          </div>
          <Fila etiqueta="Precio del auto" valor={m(op.precioVenta)} />
          {f.gastosVenta.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 border-t border-linea py-1 text-sm">
              <span>{g.concepto}</span>
              <span className="flex items-center gap-1">
                <span className="num">{m(g.importe)}</span>
                {abierta && <BotonQuitar etiqueta={`Quitar ${g.concepto}`} accion={quitarGastoVentaAccion.bind(null, id, g.id)} />}
              </span>
            </div>
          ))}
          <Fila etiqueta="Total que paga el cliente" valor={m(f.total)} fuerte />
          {abierta && (
            <div className="mt-3 rounded-lg bg-fondo p-3">
              <FormGastoVenta id={id} conceptos={CONCEPTOS_GASTO_VENTA} />
            </div>
          )}
          {!abierta && f.gastosVenta.length > 0 && <p className="mt-2 text-xs text-apagado">Al cerrar, cada gasto quedó a pagar en Caja → Cuentas pendientes.</p>}
        </section>
      )}

      <section className="tarjeta flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Cómo paga</h2>
          <span className="text-sm text-apagado">Solo efectivo y transferencias entran a la caja.</span>
        </div>
        {f.pagos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Detalle</th>
                  <th className="text-right">Importe</th>
                  <th>Impacta en</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {f.pagos.map(({ p, permuta }) => (
                  <tr key={p.id} className={p.estado === "DEVUELTA" ? "text-apagado line-through" : ""}>
                    <td>{ETIQUETA_PAGO[p.tipo]}</td>
                    <td className="whitespace-normal">
                      {p.tipo === "PERMUTA" && permuta ? (
                        <Link href={`/stock/${permuta.id}`}>
                          {permuta.marca} {permuta.modelo} {permuta.anio} {permuta.dominio ?? ""}
                        </Link>
                      ) : (
                        <>
                          {fecha(p.fecha)}
                          {p.banco && ` · ${p.banco}`}
                          {p.vence && p.tipo === "SENIA" && ` · reserva hasta ${fecha(p.vence)}`}
                        </>
                      )}
                    </td>
                    <td className="num text-right">{m(p.importe)}</td>
                    <td>{IMPACTO[p.tipo]}</td>
                    <td>
                      <span className={`chip ${ESTADO_PAGO[p.estado].clase}`}>{p.tipo === "PERMUTA" ? (p.estado === "COBRADO" ? "En stock" : p.estado === "PENDIENTE" ? "Se recibe al cerrar" : ESTADO_PAGO[p.estado].texto) : ESTADO_PAGO[p.estado].texto}</span>
                    </td>
                    <td>
                      {abierta && p.estado !== "DEVUELTA" && p.estado !== "RETENIDA" && <BotonQuitar etiqueta="Quitar pago" accion={quitarPagoAccion.bind(null, id, p.id)} />}
                      {!abierta && op.estado !== "CAIDA" && p.estado === "PENDIENTE" && p.tipo !== "PERMUTA" && <FormCobrar id={id} pagoId={p.id} tipo={p.tipo} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <b>Cubierto</b>
            <span className="num">
              {m(f.cobertura.cubierto)} de {m(f.total)}
              {f.cobertura.faltante > 0 && <span className="text-aviso-texto"> · faltan {m(f.cobertura.faltante)}</span>}
            </span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-linea" role="img" aria-label={`Cubierto ${Math.round(pctCaja + pctCobrar + pctPermuta)} %`}>
            <div className="bg-ok" style={{ width: `${pctCaja}%` }} />
            <div className="bg-acento" style={{ width: `${pctCobrar}%` }} />
            <div className="bg-grafico-stock" style={{ width: `${pctPermuta}%` }} />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-neutro-texto">
            <span>
              <span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-ok" />
              Caja {m(f.cobertura.caja)}
            </span>
            <span>
              <span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-acento" />A cobrar {m(f.cobertura.aCobrar)}
            </span>
            <span>
              <span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-grafico-stock" />
              Usado {m(f.cobertura.permuta)}
            </span>
          </div>
        </div>
        {abierta && (
          <div className="grid gap-3 lg:grid-cols-2">
            <details open={f.pagos.length === 0}>
              <summary className="btn-secundario cursor-pointer list-none">+ Seña o pago</summary>
              <div className="mt-3">
                <FormPago id={id} faltante={f.cobertura.faltante} haySena={haySena} />
              </div>
            </details>
            <details>
              <summary className="btn-secundario cursor-pointer list-none">+ Tomar usado en parte de pago</summary>
              <div className="mt-3">
                <FormPermuta id={id} participes={participes} financistaDefecto={v.participeId} tcSugerido={f.tcRef} usado={{ marca: c.usadoMarca, modelo: c.usadoModelo, anio: c.usadoAnio, detalle: c.usadoAEntregar }} />
              </div>
            </details>
          </div>
        )}
      </section>

      {op.estado !== "CAIDA" && (
        <section className="tarjeta flex flex-wrap gap-8">
          <div className="flex min-w-72 flex-1 flex-col">
            <h2 className="pb-2 text-lg font-semibold">{f.liquidacion ? "Liquidación" : "Liquidación prevista al cerrar"}</h2>
            <Fila etiqueta="Precio de venta" valor={m(l.precio)} />
            <Fila etiqueta="Costo real del auto" valor={`− ${m(l.costo)}`} />
            <Fila etiqueta="Ganancia" valor={m(l.ganancia)} fuerte />
            <Fila
              etiqueta={
                <>
                  Ganancia base ({porcentaje(l.costo ? l.gananciaBase / l.costo : 0)} del costo)
                  <Ayuda>Lo que se espera ganar con el margen base sobre el costo. Si la venta llega a esto, el inversor cobra la mitad de la base y el salón el resto; si no llega, se reparte mitad y mitad.</Ayuda>
                </>
              }
              valor={m(l.gananciaBase)}
            />
            <Fila
              etiqueta={
                <>
                  Sobreprecio
                  <Ayuda>Lo que se vendió por encima del precio sugerido. Cuando el auto lo financia un inversor, el sobreprecio es todo para el salón.</Ayuda>
                </>
              }
              valor={m(l.sobreprecio)}
            />
          </div>
          <div className="flex min-w-72 flex-1 flex-col gap-2.5">
            <h2 className="text-lg font-semibold">Reparto</h2>
            {/* K10: al inversor se le devuelve el capital que puso, además de su parte. */}
            {capital !== 0 && (
              <div className="flex justify-between gap-3 rounded-lg bg-info-fondo p-3.5">
                <span>
                  <b>{f.financista?.nombre}</b> · capital que puso
                </span>
                <span className="num">{m(capital)}</span>
              </div>
            )}
            {l.regla !== "SALON_TOTAL" && (
              <div className="flex justify-between gap-3 rounded-lg bg-info-fondo p-3.5">
                <span>
                  <b>{f.financista?.nombre}</b> · {l.regla === "INVERSOR_BASE" ? `${porcentaje(l.costo ? l.gananciaBase / l.costo / 2 : 0)} del costo` : "mitad"}
                </span>
                <span className="num">{m(l.parteInversor)}</span>
              </div>
            )}
            <div className="flex justify-between gap-3 rounded-lg bg-ok-fondo p-3.5">
              <span>
                <b>Salón</b> · {l.regla === "SALON_TOTAL" ? (v.tipoIngreso === "CONSIGNACION" ? "100 % (consignación)" : "100 % (fondos propios)") : l.regla === "INVERSOR_BASE" ? `${porcentaje(l.costo ? l.gananciaBase / l.costo / 2 : 0)} + sobreprecio` : "mitad"}
              </span>
              <span className="num">{m(l.parteSalon)}</span>
            </div>
            {f.distribuciones.length > 0 && (
              <p className="text-xs text-apagado">
                {f.distribuciones
                  .map((d) => `${d.participe} (${d.d.tipo === "CAPITAL" ? "capital" : "ganancia"}): ${d.d.estado === "PAGADO" ? "pagado" : "pendiente de pago"}`)
                  .join(" · ")}{" "}
                — se paga desde Caja.
              </p>
            )}
            {f.usd && (
              <div className="rounded-lg border border-borde bg-fondo p-3.5 text-sm leading-relaxed">
                <b>En dólares:</b> invertidos {usd(f.usd.costoUsd)} (dólar $ {v.tcIngreso.toLocaleString("es-AR")}) · {f.liquidacion ? "vendido" : "a precio actual"}{" "}
                {usd(f.usd.ventaUsd)} (dólar $ {f.tcRef?.toLocaleString("es-AR")}) · resultado <b>{usd(f.usd.gananciaUsd)} ({porcentaje(f.usd.margen)})</b>. Solo informativo.
              </div>
            )}
            {v.tipoIngreso === "CONSIGNACION" && <p className="text-sm text-suave">Al cerrar queda a pagar al dueño el monto pactado: {m(v.valorCompraArs)}.</p>}
          </div>
        </section>
      )}

      {abierta && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="tarjeta flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Cerrar la venta</h2>
            <FormCerrar id={id} tcSugerido={f.tcRef} faltantes={f.faltantes} />
          </section>
          <section className="tarjeta flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Si la operación se cae</h2>
            <FormCaer id={id} haySena={haySena} />
          </section>
        </div>
      )}

      {op.estado !== "CAIDA" && op.estado !== "ENTREGADA" && (
        <section className="tarjeta flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Entrega</h2>
            <Link href="/ventas/entregas" className="text-sm font-semibold">
              Ver calendario de entregas →
            </Link>
          </div>
          {alarma && <ChipAlerta severidad={alarma.severidad}>{alarma.texto}</ChipAlerta>}
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">Compromiso de entrega</h3>
            <FormProgramarEntrega
              key={`${op.entregaProgramada?.toISOString()}|${op.lugarEntrega}`}
              id={id}
              fecha={op.entregaProgramada ? diaArgentina(op.entregaProgramada) : null}
              hora={op.entregaProgramada ? horaArgentina(op.entregaProgramada) : null}
              lugar={op.lugarEntrega}
            />
            <p className="text-xs text-apagado">3 días antes aparece una alarma en el inicio con lo que falte terminar.</p>
          </div>
          {op.estado === "CERRADA" && (
            <div className="flex flex-col gap-2 border-t border-linea pt-4">
              <h3 className="font-semibold">Registrar la entrega</h3>
              <FormEntregar id={id} aCobrar={aCobrar} />
            </div>
          )}
        </section>
      )}

      <section className="tarjeta flex flex-col">
        <h2 className="pb-2 text-lg font-semibold">Historial</h2>
        {f.historial.map(({ a, usuario }) => (
          <div key={a.id} className="flex flex-wrap gap-x-4 border-t border-linea py-2 text-sm">
            <span className="num min-w-36 text-apagado">{a.fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
            <span>
              <b>{usuario ?? "Sistema"}</b> · {a.descripcion ?? a.accion.toLowerCase()}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
