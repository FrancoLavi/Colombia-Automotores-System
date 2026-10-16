import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { contarAgenda, listarContactos, pedidosAbiertos } from "@/server/contactos";
import { fecha, hoyIso, pesos } from "@/lib/formato";
import { ETIQUETA_ETAPA, ETIQUETA_ORIGEN, type Etapa, type Origen } from "@/domain/contactos";
import { FormContacto } from "./formularios";
import { ChipEtapa, ChipOrigen, Telefono } from "./chips";

export const metadata = { title: "Contactos · Colombia Automotores" };

type Busqueda = { q?: string; etapa?: string; origen?: string };

export default async function ContactosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const hoy = hoyIso();
  const [{ contactos, conteo }, enAgenda, pedidos] = await Promise.all([listarContactos(sp), contarAgenda(hoy), pedidosAbiertos()]);
  const etapas: Etapa[] = ["DATO", "PREVENTA", "CLIENTE", "DESCARTADO"];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contactos</h1>
          <p className="mt-1 text-suave">Todo el que consulta se carga como dato. Después pasa a preventa y a cliente.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/contactos/agenda" className="btn-secundario">
            Agenda de hoy{enAgenda ? ` · ${enAgenda}` : ""}
          </Link>
          <Link href="/contactos/pedidos" className="btn-secundario">
            Pedidos · {pedidos.length}
          </Link>
          <Link href="/contactos/importar" className="btn-secundario">
            Importar
          </Link>
        </div>
      </header>

      <details className="tarjeta" open={contactos.length === 0 && !sp.q}>
        <summary className="cursor-pointer text-lg font-semibold">+ Carga rápida de un dato</summary>
        <div className="mt-4">
          <FormContacto rapido />
        </div>
      </details>

      <nav aria-label="Etapas" className="flex flex-wrap gap-2.5">
        <Link href="/contactos" className={`chip px-3.5 py-2 text-[13px] ${!sp.etapa ? "bg-tinta text-white" : "border border-borde bg-white text-tinta"}`}>
          Todos · {Object.values(conteo).reduce((a, b) => a + (b ?? 0), 0)}
        </Link>
        {etapas.map((e) => (
          <Link
            key={e}
            href={`/contactos?etapa=${e}`}
            className={`chip px-3.5 py-2 text-[13px] ${sp.etapa === e ? "bg-tinta text-white" : "border border-borde bg-white text-tinta"}`}
          >
            {ETIQUETA_ETAPA[e]} · {conteo[e] ?? 0}
          </Link>
        ))}
      </nav>

      <form method="get" className="tarjeta grid gap-3 p-4 sm:grid-cols-[1fr_200px_auto]">
        {sp.etapa && <input type="hidden" name="etapa" value={sp.etapa} />}
        <label className="campo">
          Buscar
          <input type="search" name="q" defaultValue={sp.q} placeholder="Nombre, teléfono, localidad o qué busca" />
        </label>
        <label className="campo">
          Origen
          <select name="origen" defaultValue={sp.origen ?? ""}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETA_ORIGEN) as Origen[]).map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_ORIGEN[o]}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secundario self-end">Buscar</button>
      </form>

      <section className="flex flex-col gap-2.5" aria-label="Listado de contactos">
        {contactos.length === 0 && <p className="tarjeta text-suave">No hay contactos con estos filtros.</p>}
        {contactos.map((c) => {
          const atrasado = c.proximoContacto && c.proximoContacto <= hoy;
          return (
            <article key={c.id} className="tarjeta flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <div className="flex min-w-48 flex-1 flex-col gap-1">
                <Link href={`/contactos/${c.id}`} className="font-semibold text-tinta">
                  {c.nombre} {c.apellido}
                </Link>
                <div className="flex flex-wrap gap-1.5">
                  <ChipEtapa etapa={c.etapa} />
                  <ChipOrigen origen={c.origen} />
                </div>
              </div>
              <div className="min-w-40 text-sm">
                <Telefono telefono={c.telefono} />
              </div>
              <div className="min-w-48 flex-1 text-sm text-suave">
                {c.productoInteres ?? "—"}
                {c.usadoAEntregar && <span> · entrega {c.usadoAEntregar}</span>}
                {c.calificacionMonto && (
                  <span>
                    {" "}
                    · califica {pesos(c.calificacionMonto)}
                    {c.calificacionBanco && ` (${c.calificacionBanco})`}
                  </span>
                )}
              </div>
              <div className={`text-sm ${atrasado ? "font-semibold text-aviso-texto" : "text-apagado"}`}>
                {c.proximoContacto ? `Contactar ${c.proximoContacto === hoy ? "hoy" : fecha(c.proximoContacto)}` : ""}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
