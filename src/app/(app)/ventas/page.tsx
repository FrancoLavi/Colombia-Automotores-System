import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { FilaEnlace, FormFiltros } from "@/components/filtros";
import { CamposFiltroAuto, TdAuto, ThAuto } from "@/components/auto";
import { coincideAuto, leerFiltroAuto, opcionesAuto } from "@/domain/autos";
import { Vacio } from "@/components/ilustraciones";
import { vistaMoneda } from "@/lib/moneda";
import { listarOperaciones } from "@/server/ventas";
import { nombreContacto, fecha, hoyIso } from "@/lib/formato";
import { ChipOperacion } from "./chip";

export const metadata = { title: "Ventas · Colombia Automotores" };

const PESTANAS = [
  { clave: "ABIERTAS", titulo: "Abiertas", estados: ["PREVENTA", "SENIADA"] },
  { clave: "CERRADAS", titulo: "Cerradas sin entregar", estados: ["CERRADA"] },
  { clave: "ENTREGADAS", titulo: "Entregadas", estados: ["ENTREGADA"] },
  { clave: "CAIDAS", titulo: "Caídas", estados: ["CAIDA"] },
] as const;

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ ver?: string; marca?: string; modelo?: string; patente?: string }> }) {
  await requerirUsuario();
  const { m } = await vistaMoneda();
  const sp = await searchParams;
  const ver = (PESTANAS.find((p) => p.clave === sp.ver)?.clave ?? "ABIERTAS") as (typeof PESTANAS)[number]["clave"];
  const filtroAuto = leerFiltroAuto(sp);
  const { operaciones: todas, conteo } = await listarOperaciones(ver);
  const operaciones = todas.filter((o) => coincideAuto(o.auto, filtroAuto));
  const { marcas, modelos } = opcionesAuto(todas.map((o) => o.auto));
  const hoy = hoyIso();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ventas</h1>
          <p className="mt-1 text-suave">Preventa → seña → cierre → entrega.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/ventas/entregas" className="btn-secundario">
            Calendario de entregas
          </Link>
          <Link href="/ventas/nueva" className="btn-primario">
            + Nueva venta
          </Link>
        </div>
      </header>

      <nav aria-label="Estados" className="flex flex-wrap gap-2.5">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/ventas?ver=${p.clave}`}
            className={`chip px-3.5 py-2 text-[13px] ${ver === p.clave ? "bg-invertido text-invertido-texto" : "border border-borde bg-superficie text-tinta"}`}
          >
            {p.titulo} · {p.estados.reduce((a, e) => a + (conteo[e] ?? 0), 0)}
          </Link>
        ))}
      </nav>

      <FormFiltros plegable fijos={["ver"]} porDefecto={{ ver: "ABIERTAS" }} className="tarjeta grid gap-3.5 p-4 sm:grid-cols-3">
        <input type="hidden" name="ver" value={ver} />
        <CamposFiltroAuto valores={filtroAuto} marcas={marcas} modelos={modelos} />
      </FormFiltros>

      <section className="tarjeta overflow-x-auto p-0">
        {operaciones.length === 0 ? (
          <Vacio>
            No hay operaciones acá. <Link href="/ventas/nueva">Armá una nueva venta</Link>.
          </Vacio>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <ThAuto />
                <th className="text-right">Precio</th>
                <th>Cubierto</th>
                <th>Estado</th>
                <th>Atención</th>
              </tr>
            </thead>
            <tbody>
              {operaciones.map((o) => {
                const pct = Math.min(100, Math.round((o.cobertura.cubierto / o.total) * 100));
                return (
                  <FilaEnlace key={o.op.id} href={`/ventas/${o.op.id}`}>
                    <td>
                      <Link href={`/ventas/${o.op.id}`} className="num font-medium">
                        {o.numero}
                      </Link>
                    </td>
                    <td className="num">{fecha(o.op.fechaPreventa)}</td>
                    <td>
                      <Link href={`/contactos/${o.contacto.id}`} className="text-tinta">
                        {nombreContacto(o.contacto)}
                      </Link>
                    </td>
                    <TdAuto auto={o.auto} href={`/stock/${o.auto.id}`} anio />
                    <td className="num text-right">{m(o.total)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-linea" aria-hidden="true">
                          <div className={`h-2 rounded-full ${pct === 100 ? "bg-ok" : "bg-acento"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="num text-xs">{pct} %</span>
                      </div>
                    </td>
                    <td>
                      <ChipOperacion estado={o.op.estado} />
                    </td>
                    <td className="text-xs">
                      {o.venceSena && o.op.estado === "SENIADA" && o.venceSena <= hoy && <span className="chip bg-aviso-texto text-white">Seña vencida</span>}
                      {o.aCobrar > 0 && (o.op.estado === "CERRADA" || o.op.estado === "ENTREGADA") && (
                        <span className="chip bg-aviso-fondo text-aviso-texto">A cobrar {m(o.aCobrar)}</span>
                      )}
                      {o.op.estado === "CAIDA" && o.op.motivoCaida}
                    </td>
                  </FilaEnlace>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
