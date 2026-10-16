import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { fichaContacto } from "@/server/contactos";
import { marcasUsadas } from "@/server/vehiculos";
import { fecha, pesos } from "@/lib/formato";
import { describirPedido, ETIQUETA_ACTIVIDAD } from "@/domain/contactos";
import { ChipEstado } from "@/components/ui";
import { ChipEtapa, ChipOrigen, Telefono } from "../chips";
import { AccionesEtapa, BotonesPedido, FormActividad, FormCompletar, FormContacto, FormPedido } from "../formularios";

const fechaHora = (d: Date) => d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function FichaContactoPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const id = Number((await params).id);
  const f = await fichaContacto(id);
  if (!f) notFound();
  const marcas = await marcasUsadas();
  const c = f.c;
  const pendientes = f.actividades.filter((x) => !x.a.realizadaEn);
  const hechas = f.actividades.filter((x) => x.a.realizadaEn);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contactos" className="text-sm font-semibold">
        ← Volver a contactos
      </Link>

      <header className="tarjeta flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <ChipEtapa etapa={c.etapa} />
            <ChipOrigen origen={c.origen} />
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {c.nombre} {c.apellido}
          </h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-suave">
            <Telefono telefono={c.telefono} />
            {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
            {c.localidad && <span>{c.localidad}</span>}
            {c.calificacionMonto && (
              <span>
                Califica {pesos(c.calificacionMonto)}
                {c.calificacionBanco && ` · ${c.calificacionBanco}`}
              </span>
            )}
          </div>
          {c.proximoContacto && <p className="text-sm">Próximo contacto: <b>{fecha(c.proximoContacto)}</b></p>}
        </div>
        <AccionesEtapa id={id} opciones={f.etapasManuales as ("DATO" | "DESCARTADO")[]} />
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Seguimiento</h2>
          <FormActividad contactoId={id} />
          {pendientes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-apagado">Agendado</h3>
              {pendientes.map(({ a }) => (
                <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-aviso-fondo bg-[#fffaf5] p-3 text-sm">
                  <span>
                    <b>{fechaHora(a.fechaProgramada)}</b> · {ETIQUETA_ACTIVIDAD[a.tipo]}
                    {a.nota && ` · ${a.nota}`}
                  </span>
                  <FormCompletar actividadId={a.id} contactoId={id} />
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col">
            {hechas.map(({ a, usuario }) => (
              <div key={a.id} className="border-t border-linea py-2 text-sm">
                <span className="num text-apagado">{fechaHora(a.realizadaEn!)}</span> · <b>{ETIQUETA_ACTIVIDAD[a.tipo]}</b>
                {usuario && <span className="text-apagado"> ({usuario})</span>}
                {a.nota && <p className="mt-0.5">{a.nota}</p>}
              </div>
            ))}
            {f.actividades.length === 0 && <p className="text-sm text-apagado">Todavía no hay contactos registrados.</p>}
          </div>
        </section>

        <section className="tarjeta flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Qué busca</h2>
          {(c.productoInteres || c.usadoAEntregar) && (
            <p className="text-sm">
              {c.productoInteres}
              {c.usadoAEntregar && <span className="text-suave"> · Entrega: {c.usadoAEntregar}</span>}
            </p>
          )}
          {f.pedidos.map((p) => (
            <div key={p.id} className={`flex flex-col gap-2 rounded-lg border border-borde p-3 ${p.estado !== "ABIERTO" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm">{describirPedido(p)}</b>
                <BotonesPedido contactoId={id} pedidoId={p.id} estado={p.estado} />
              </div>
              {p.notas && <p className="text-sm text-suave">{p.notas}</p>}
              {p.estado === "ABIERTO" &&
                (p.coincidencias.length ? (
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="text-ok-texto">En stock:</span>
                    {p.coincidencias.map((v) => (
                      <Link key={v.id} href={`/stock/${v.id}`} className="chip border border-borde bg-white text-tinta">
                        {v.marca} {v.modelo} {v.anio} · {pesos(v.precio)}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-apagado">Nada en stock por ahora.</span>
                ))}
              {p.estado !== "ABIERTO" && <span className="text-xs uppercase text-apagado">{p.estado.toLowerCase()}</span>}
            </div>
          ))}
          <details>
            <summary className="btn-secundario cursor-pointer list-none">+ Registrar pedido</summary>
            <div className="mt-3">
              <FormPedido contactoId={id} marcas={marcas} />
            </div>
          </details>
          {f.autosTraidos.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-linea pt-3 text-sm">
              <h3 className="font-semibold">Autos que nos trajo</h3>
              {f.autosTraidos.map((v) => (
                <Link key={v.id} href={`/stock/${v.id}`} className="flex items-center gap-2 text-tinta">
                  {v.marca} {v.modelo} {v.anio} {v.dominio ?? ""} · {v.tipoIngreso.toLowerCase()} <ChipEstado estado={v.estado} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <details className="tarjeta">
        <summary className="cursor-pointer text-lg font-semibold">Editar datos del contacto</summary>
        <div className="mt-4">
          <FormContacto id={id} inicial={c} />
        </div>
      </details>

      <section className="tarjeta flex flex-col">
        <h2 className="pb-2 text-lg font-semibold">Historial de cambios</h2>
        {f.historial.map(({ a, usuario }) => (
          <div key={a.id} className="flex flex-wrap gap-x-4 border-t border-linea py-2 text-sm">
            <span className="num min-w-36 text-apagado">{fechaHora(a.fecha)}</span>
            <span>
              <b>{usuario ?? "Sistema"}</b> · {a.descripcion ?? a.accion.toLowerCase()}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
