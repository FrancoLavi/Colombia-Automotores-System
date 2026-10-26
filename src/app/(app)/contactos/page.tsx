import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { listarBancosActivos } from "@/server/configuracion";
import { marcasUsadas } from "@/server/vehiculos";
import { vistaMoneda } from "@/lib/moneda";
import { contarAgenda, listarContactos, pedidosAbiertos } from "@/server/contactos";
import { nombreContacto, fecha, hoyIso } from "@/lib/formato";
import { ETIQUETA_ETAPA, ETIQUETA_ORIGEN, type Etapa, type Origen } from "@/domain/contactos";
import { FormContacto } from "./formularios";
import { ChipEtapa, ChipOrigen, Telefono } from "./chips";

export const metadata = { title: "Contactos · Colombia Automotores" };

type Busqueda = { q?: string; etapa?: string; origen?: string; marca?: string; modelo?: string; montoMin?: string; banco?: string };

export default async function ContactosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const { m } = await vistaMoneda();
  const sp = await searchParams;
  const hoy = hoyIso();
  const filtros = { ...sp, montoMin: sp.montoMin ? Number(sp.montoMin.replace(/\D/g, "")) : undefined };
  const [{ contactos, conteo }, enAgenda, pedidos, bancosActivos, marcas] = await Promise.all([
    listarContactos(filtros),
    contarAgenda(hoy),
    pedidosAbiertos(),
    listarBancosActivos(),
    marcasUsadas(),
  ]);
  const bancos = bancosActivos.map((b) => b.nombre);
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
          <FormContacto rapido bancos={bancos} marcas={marcas} />
        </div>
      </details>

      <nav aria-label="Etapas" className="flex flex-wrap gap-2.5">
        <Link href="/contactos" className={`chip px-3.5 py-2 text-[13px] ${!sp.etapa ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}>
          Todos · {Object.values(conteo).reduce((a, b) => a + (b ?? 0), 0)}
        </Link>
        {etapas.map((e) => (
          <Link
            key={e}
            href={`/contactos?etapa=${e}`}
            className={`chip px-3.5 py-2 text-[13px] ${sp.etapa === e ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}
          >
            {ETIQUETA_ETAPA[e]} · {conteo[e] ?? 0}
          </Link>
        ))}
      </nav>

      <form method="get" className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {sp.etapa && <input type="hidden" name="etapa" value={sp.etapa} />}
        <label className="campo lg:col-span-2">
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
        <label className="campo">
          Banco que lo califica
          <select name="banco" defaultValue={sp.banco ?? ""}>
            <option value="">Todos</option>
            {bancos.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Marca (busca o entrega)
          <input name="marca" list="marcas-filtro" defaultValue={sp.marca} placeholder="Volkswagen" />
          <datalist id="marcas-filtro">
            {marcas.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </label>
        <label className="campo">
          Modelo (busca o entrega)
          <input name="modelo" defaultValue={sp.modelo} placeholder="Amarok" />
        </label>
        <label className="campo">
          Califica desde ($)
          <input name="montoMin" inputMode="numeric" defaultValue={sp.montoMin} placeholder="10.000.000" />
        </label>
        <div className="flex items-end gap-2">
          <button className="btn-secundario">Buscar</button>
          {(sp.q || sp.origen || sp.banco || sp.marca || sp.modelo || sp.montoMin) && (
            <Link href={sp.etapa ? `/contactos?etapa=${sp.etapa}` : "/contactos"} className="btn text-sm text-acento">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <section className="flex flex-col gap-2.5" aria-label="Listado de contactos">
        {contactos.length === 0 && <p className="tarjeta text-suave">No hay contactos con estos filtros.</p>}
        {contactos.map((c) => {
          const atrasado = c.proximoContacto && c.proximoContacto <= hoy;
          return (
            // Grilla de columnas fijas en escritorio: si cada fila se midiera por su propio
            // contenido, el teléfono y lo demás quedarían en una x distinta en cada fila.
            // En celular se apila, que es como conviene a lo ancho de un teléfono.
            <article
              key={c.id}
              className="tarjeta grid items-center gap-x-6 gap-y-2 px-4 py-3 md:grid-cols-[minmax(11rem,1.2fr)_9.5rem_minmax(12rem,1.6fr)_10rem]"
            >
              <div className="flex flex-col gap-1">
                <Link href={`/contactos/${c.id}`} className="font-semibold text-tinta">
                  {nombreContacto(c)}
                </Link>
                <div className="flex flex-wrap gap-1.5">
                  <ChipEtapa etapa={c.etapa} />
                  <ChipOrigen origen={c.origen} />
                </div>
              </div>
              <div className="text-sm">
                <Telefono telefono={c.telefono} />
              </div>
              <div className="text-sm text-suave">
                {c.productoInteres ?? "—"}
                {c.usadoAEntregar && <span> · entrega {c.usadoAEntregar}</span>}
                {c.calificacionMonto && (
                  <span>
                    {" "}
                    · califica {m(c.calificacionMonto)}
                    {c.calificacionBanco && ` (${c.calificacionBanco})`}
                  </span>
                )}
              </div>
              <div className={`text-sm md:text-right ${atrasado ? "font-semibold text-aviso-texto" : "text-apagado"}`}>
                {c.proximoContacto ? `Contactar ${c.proximoContacto === hoy ? "hoy" : fecha(c.proximoContacto)}` : ""}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
