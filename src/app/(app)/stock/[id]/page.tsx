import Link from "next/link";
import { Patente } from "@/components/auto";
import { notFound } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { datosFormulario, fichaVehiculo } from "@/server/vehiculos";
import { interesadosEnAuto } from "@/server/contactos";
import { operacionAbiertaDeVehiculo } from "@/server/ventas";
import { Telefono } from "../../contactos/chips";
import { nombreContacto, fecha, numero, porcentaje, usd, fechaHora } from "@/lib/formato";
import { BotonQuitar, ChipAlerta, ChipEstado, Ayuda } from "@/components/ui";
import { eliminarGastoAccion, quitarArchivoAccion } from "../actions";
import {
  AccionesEstado,
  BotonHabilitar,
  FilaDocumento,
  FormGasto,
  FormPeritaje,
  FormPrecio,
  FormUbicacion,
  SubirFotos,
} from "./formularios";

const TIPO_INGRESO = { COMPRA: "compra", PERMUTA: "permuta", CONSIGNACION: "consignación" } as const;
const RESULTADO = { APTO: "Apto", APTO_CON_OBS: "Apto con observaciones", NO_APTO: "No apto" } as const;

function Fila({ etiqueta, valor, fuerte }: { etiqueta: React.ReactNode; valor: React.ReactNode; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 border-t border-linea py-2 text-sm ${fuerte ? "text-[15px] font-semibold" : ""}`}>
      <span>{etiqueta}</span>
      <span className="num text-right">{valor}</span>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const v = await db.query.vehiculos.findFirst({ where: eq(s.vehiculos.id, Number((await params).id)) });
  return { title: `${v ? `${v.marca} ${v.modelo}${v.dominio ? ` ${v.dominio}` : ""}` : "Auto"} · Colombia Automotores` };
}

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { m } = await vistaMoneda();
  const id = Number((await params).id);
  const f = await fichaVehiculo(id);
  if (!f) notFound();
  const { categorias } = await datosFormulario();
  const enStock = ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"].includes(f.v.estado);
  const interesados = enStock ? await interesadosEnAuto({ ...f.v, precio: f.precio }) : [];
  const operacion = await operacionAbiertaDeVehiculo(id);
  const v = f.v;
  const vendido = v.estado === "VENDIDO" || v.estado === "ENTREGADO";
  const fotos = f.archivos.filter((x) => x.tipo === "FOTO_PERITAJE");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/stock" className="text-sm font-semibold">
        ← Volver al stock
      </Link>

      <header className="tarjeta flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Patente dominio={v.dominio} />
            <ChipEstado estado={v.estado} />
            {v.prendado && <span className="chip bg-aviso-fondo text-aviso-texto">Prendado</span>}
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {v.marca} {v.modelo} {v.version}
          </h1>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {[
              ["Marca", v.marca],
              ["Modelo", v.modelo],
              ["Patente", v.dominio ?? "Sin patente"],
            ].map(([k, x]) => (
              <div key={k} className="flex gap-1.5">
                <dt className="text-apagado">{k}</dt>
                <dd className={`font-semibold ${k === "Patente" ? "num tracking-wider" : ""}`}>{x}</dd>
              </div>
            ))}
          </dl>
          <p className="text-suave">
            {v.anio} · {numero(v.km)} km{v.color ? ` · ${v.color}` : ""} · ingresó por <b>{TIPO_INGRESO[v.tipoIngreso]}</b> el {fecha(v.fechaIngreso)}
            {v.estado !== "POR_INGRESAR" && ` · ${f.dias} días en stock`}
          </p>
          <p className="text-sm text-suave">
            Financia: <b>{f.financista?.nombre}</b>
            {v.ingresadoPor && ` · Lo ingresó: ${v.ingresadoPor}`}
            {f.contactoOrigen && ` · ${v.tipoIngreso === "CONSIGNACION" ? "Dueño" : "Vendedor"}: ${nombreContacto(f.contactoOrigen)}`}
          </p>
          {v.prendado && (
            <p className="text-sm text-aviso-texto">
              <b>Prenda:</b> {v.prendaDetalle ?? "sin detalle"} · requiere la cancelación de prenda para venderlo.
            </p>
          )}
          {f.alertas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {f.alertas.map((al, i) => (
                <ChipAlerta key={i} severidad={al.severidad}>
                  {al.texto}
                </ChipAlerta>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FormUbicacion key={v.ubicacion} id={id} actual={v.ubicacion} />
          <Link href={`/stock/${id}/editar`} className="btn-secundario">
            Editar datos
          </Link>
          {operacion ? (
            <Link href={`/ventas/${operacion.id}`} className="btn-primario">
              Ver venta {operacion.numero}
            </Link>
          ) : (
            v.estado === "DISPONIBLE" && (
              <Link href={`/ventas/nueva?vehiculo=${id}`} className="btn-primario">
                Vender
              </Link>
            )
          )}
        </div>
      </header>

      {v.estado === "POR_INGRESAR" && (
        <section className="tarjeta flex flex-col gap-3 border-aviso-texto/40 bg-aviso-fondo/40">
          <h2 className="text-lg font-semibold">Para dejarlo disponible</h2>
          <BotonHabilitar id={id} faltantes={f.faltantes} />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* #gastos: desde Caja se llega acá para corregir el gasto que generó un movimiento. */}
        <section id="gastos" className="tarjeta flex scroll-mt-4 flex-col">
          <h2 className="pb-2 text-lg font-semibold">Costo real</h2>
          <Fila
            etiqueta={
              <>
                {v.tipoIngreso === "CONSIGNACION" ? "Pactado con el dueño" : "Valor de compra"}{" "}
                <span className="text-apagado">
                  · dólar $ {v.tcIngreso.toLocaleString("es-AR")}
                  {v.valorCompraUsd ? ` · ${usd(v.valorCompraUsd)}` : ""}
                </span>
              </>
            }
            valor={m(v.valorCompraArs)}
          />
          {f.gastos.map(({ g, categoria }) => (
            <div key={g.id} className="flex items-center justify-between gap-3 border-t border-linea py-1 text-sm">
              <span>
                {categoria}
                {g.descripcion && <span className="text-apagado"> · {g.descripcion}</span>}
                <span className="text-apagado"> · {fecha(g.fecha)}</span>
                {g.pagadoPor === "DUENO" && <span className="chip ml-2 bg-neutro-fondo text-neutro-texto">Lo pagó {f.dueno}</span>}
                {g.estado === "PENDIENTE" && <span className="chip ml-2 bg-aviso-fondo text-aviso-texto">A pagar</span>}
                {g.extraordinario && <span className="chip ml-2 bg-neutro-fondo text-neutro-texto">Extraordinario</span>}
              </span>
              <span className="flex items-center gap-1">
                <span className={`num ${g.extraordinario ? "text-apagado line-through" : ""}`}>{m(g.importe)}</span>
                <BotonQuitar etiqueta="Eliminar gasto" accion={eliminarGastoAccion.bind(null, id, g.id)} />
              </span>
            </div>
          ))}
          <Fila etiqueta="Costo total" valor={m(f.costo)} fuerte />
          <Fila etiqueta={<span className="text-apagado">Invertido en dólares (al dólar fijado)</span>} valor={usd(f.costoUsd)} />
          <details className="mt-3">
            <summary className="btn-secundario cursor-pointer list-none">+ Cargar gasto</summary>
            <div className="mt-3">
              <FormGasto id={id} categorias={categorias} vendido={vendido} dueno={f.dueno} consignacion={v.tipoIngreso === "CONSIGNACION"} />
            </div>
          </details>
        </section>

        <section className="tarjeta flex flex-col">
          <h2 className="pb-2 text-lg font-semibold">Precio</h2>
          <Fila
            etiqueta={
              <>
                Sugerido (costo + {porcentaje(f.margenBase)})
                <Ayuda>Costo real (compra + gastos, incluido el peritaje) más el margen base que se configura en Configuración. Es en pesos y no se mueve con el dólar.</Ayuda>
              </>
            }
            valor={m(f.sugerido - v.ajustePrecio)}
          />
          {v.ajustePrecio !== 0 && <Fila etiqueta="Ajuste comercial" valor={`${v.ajustePrecio > 0 ? "+ " : ""}${m(v.ajustePrecio)}`} />}
          <Fila etiqueta="Precio publicado" valor={m(f.precio)} fuerte />
          {f.margen ? (
            <div className={`my-3 flex flex-col gap-1 rounded-lg p-3.5 text-sm ${f.margen.alerta ? "bg-aviso-fondo text-aviso-texto" : "bg-ok-fondo text-ok-texto"}`}>
              <b>
                Margen en dólares: {porcentaje(f.margen.margen)}
                <Ayuda>Cuánto rinde el precio pasado al blue de hoy contra lo invertido al dólar fijado al comprar. Es solo informativo; por debajo del umbral salta una alerta.</Ayuda>
              </b>
              <span>
                Con el blue a $ {f.tc!.valor.toLocaleString("es-AR")} ({fecha(f.tc!.fecha)}), el precio rinde {usd(f.margen.ventaUsd)} contra {usd(f.margen.costoUsd)}{" "}
                invertidos.{f.margen.alerta && " Bajó del umbral de alerta: conviene revisar el precio o priorizar la venta."}
              </span>
            </div>
          ) : (
            <p className="my-3 text-sm text-apagado">Cargá el dólar blue de hoy en el listado de stock para ver el margen en dólares.</p>
          )}
          <FormPrecio key={`${v.ajustePrecio}|${v.precioPublicado}`} id={id} ajuste={v.ajustePrecio} publicado={v.precioPublicado} sugerido={f.sugerido} />
        </section>
      </div>

      {interesados.length > 0 && (
        <section className="tarjeta flex flex-col gap-2 border-ok/40 bg-ok-fondo/40">
          <h2 className="text-lg font-semibold">Clientes que buscan algo así · {interesados.length}</h2>
          <div className="flex flex-col">
            {interesados.map((i) => (
              <div key={i.pedidoId} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-linea py-2 text-sm">
                <Link href={`/contactos/${i.contacto.id}`} className="font-semibold">
                  {nombreContacto(i.contacto)}
                </Link>
                <Telefono telefono={i.contacto.telefono} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta flex flex-col">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-lg font-semibold">Papeles</h2>
            {f.documentos.some((d) => d.obligatorio && d.estado === "PENDIENTE") ? (
              <span className="chip bg-aviso-fondo text-aviso-texto">Incompletos</span>
            ) : (
              <span className="chip bg-ok-fondo text-ok-texto">Completos</span>
            )}
          </div>
          {f.documentos.map((d) => (
            <FilaDocumento key={`${d.id}|${d.estado}|${d.fechaVencimiento}`} vehiculoId={id} doc={d} />
          ))}
        </section>

        <section className="tarjeta flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Peritaje</h2>
            {f.peritaje && (
              <span className={`chip ${f.peritaje.resultado === "NO_APTO" ? "bg-aviso-texto text-white" : "bg-ok-fondo text-ok-texto"}`}>
                {RESULTADO[f.peritaje.resultado].toUpperCase()}
              </span>
            )}
          </div>
          <FormPeritaje key={JSON.stringify(f.peritaje ?? null)} id={id} actual={f.peritaje ?? null} />
          <div className="grid grid-cols-3 gap-2 border-t border-linea pt-3">
            {fotos.map((x) => (
              <div key={x.id} className="relative">
                <a href={`/api/archivos/${x.id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fotos privadas servidas por /api/archivos */}
                  <img src={`/api/archivos/${x.id}`} alt={x.nombre ?? "Foto del peritaje"} className="aspect-[4/3] w-full rounded-lg object-cover" />
                </a>
                <span className="absolute right-0 top-0 rounded-lg bg-superficie/90">
                  <BotonQuitar etiqueta="Quitar foto" accion={quitarArchivoAccion.bind(null, id, x.id)} soloIcono />
                </span>
              </div>
            ))}
          </div>
          {fotos.length === 0 && <p className="text-sm text-apagado">Sin fotos todavía (se recomiendan 5 o 6).</p>}
          <SubirFotos id={id} />
        </section>
      </div>

      {(f.transiciones.length > 0 || v.observaciones) && (
        <section className="tarjeta flex flex-col gap-3">
          {v.observaciones && (
            <p className="text-sm">
              <b>Observaciones:</b> {v.observaciones}
            </p>
          )}
          <AccionesEstado id={id} transiciones={f.transiciones} />
        </section>
      )}

      <section className="tarjeta flex flex-col">
        <h2 className="pb-2 text-lg font-semibold">Historial de cambios</h2>
        {f.historial.map(({ a, usuario }) => (
          <div key={a.id} className="flex flex-wrap gap-x-4 border-t border-linea py-2 text-sm">
            <span className="num min-w-36 text-apagado">
              {fechaHora(a.fecha)}
            </span>
            <span>
              <b>{usuario ?? "Sistema"}</b> · {a.descripcion ?? a.accion.toLowerCase()}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
