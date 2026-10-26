import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { Vacio } from "@/components/ilustraciones";
import { ChipAlerta } from "@/components/ui";
import { entregasProgramadas } from "@/server/ventas";
import { desdeArgentina, diaArgentina, horaArgentina, semanasDelMes, DIAS_ALARMA_ENTREGA } from "@/domain/entregas";
import { fecha } from "@/lib/formato";
import { ChipOperacion } from "../chip";

export const metadata = { title: "Entregas · Colombia Automotores" };

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const mesIso = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, "0")}`;
function correr(anio: number, mes: number, delta: number) {
  const d = new Date(Date.UTC(anio, mes - 1 + delta, 1));
  return mesIso(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export default async function EntregasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requerirUsuario();
  const hoy = diaArgentina(new Date());
  const pedido = (await searchParams).mes;
  const [anio, mes] = (/^\d{4}-\d{2}$/.test(pedido ?? "") ? pedido! : hoy.slice(0, 7)).split("-").map(Number);
  const desde = desdeArgentina(`${mesIso(anio, mes)}-01`, "00:00");
  const hasta = desdeArgentina(`${correr(anio, mes, 1)}-01`, "00:00");
  const [delMes, pendientes] = await Promise.all([entregasProgramadas({ desde, hasta }), entregasProgramadas()]);
  const porDia = new Map<string, typeof delMes>();
  for (const e of delMes) {
    const d = diaArgentina(e.cuando);
    porDia.set(d, [...(porDia.get(d) ?? []), e]);
  }
  const conAlarma = pendientes.filter((e) => e.alarma);
  const proximas = pendientes.filter((e) => !e.alarma);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/ventas" className="text-sm font-semibold">
        ← Volver a ventas
      </Link>
      <header>
        <h1 className="text-3xl font-bold">Calendario de entregas</h1>
        <p className="mt-1 text-suave">
          La fecha se compromete desde cada venta. {DIAS_ALARMA_ENTREGA} días antes salta una alarma con lo que falte terminar.
        </p>
      </header>

      {conAlarma.length > 0 && (
        <section className="tarjeta flex flex-col gap-1 border-aviso-texto/40 bg-aviso-fondo/40">
          <h2 className="pb-1 text-lg font-semibold">Para preparar ya</h2>
          {conAlarma.map((e) => (
            <FilaEntrega key={e.op.id} e={e} />
          ))}
        </section>
      )}

      <section className="tarjeta flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/ventas/entregas?mes=${correr(anio, mes, -1)}`} className="btn-secundario" aria-label="Mes anterior">
            ←
          </Link>
          <h2 className="text-xl font-semibold">
            {MESES[mes - 1]} {anio}
          </h2>
          <Link href={`/ventas/entregas?mes=${correr(anio, mes, 1)}`} className="btn-secundario" aria-label="Mes siguiente">
            →
          </Link>
        </div>

        {/* Grilla (tablet y escritorio) */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 gap-1.5 pb-1.5 text-center text-xs font-semibold uppercase tracking-wide text-apagado">
            {DIAS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {semanasDelMes(anio, mes)
              .flat()
              .map((dia, i) =>
                dia ? (
                  <div
                    key={dia}
                    className={`flex min-h-24 flex-col gap-1 rounded-lg border p-1.5 text-xs ${dia === hoy ? "border-acento bg-info-fondo/50" : "border-linea bg-superficie"}`}
                  >
                    <span className={`num ${dia === hoy ? "font-bold text-acento" : "text-apagado"}`}>{Number(dia.slice(8))}</span>
                    {(porDia.get(dia) ?? []).map((e) => (
                      <Link
                        key={e.op.id}
                        href={`/ventas/${e.op.id}`}
                        title={`${e.auto.marca} ${e.auto.modelo} · ${e.contacto.nombre} ${e.contacto.apellido ?? ""}`}
                        className={`block rounded px-1.5 py-1 leading-tight no-underline ${
                          e.op.estado === "ENTREGADA"
                            ? "bg-ok-fondo text-ok-texto"
                            : e.alarma?.severidad === "CRITICA"
                              ? "bg-aviso-fondo text-aviso-texto"
                              : "bg-neutro-fondo text-tinta"
                        }`}
                      >
                        <b className="num">{horaArgentina(e.cuando)}</b> {e.auto.marca} {e.auto.modelo}
                        <span className="block truncate opacity-80">{e.contacto.nombre}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div key={`v${i}`} />
                ),
              )}
          </div>
        </div>

        {/* Lista (celular) */}
        <div className="flex flex-col sm:hidden">
          {delMes.length === 0 ? (
            <p className="text-sm text-apagado">No hay entregas en este mes.</p>
          ) : (
            delMes.map((e) => <FilaEntrega key={e.op.id} e={e} />)
          )}
        </div>
      </section>

      <section className="tarjeta flex flex-col gap-1">
        <h2 className="pb-1 text-lg font-semibold">Próximas entregas</h2>
        {proximas.length === 0 && conAlarma.length === 0 ? (
          <Vacio>No hay entregas programadas. Se programan desde cada venta, en la sección Entrega.</Vacio>
        ) : proximas.length === 0 ? (
          <p className="text-sm text-apagado">Todas las programadas están en los próximos {DIAS_ALARMA_ENTREGA} días (arriba).</p>
        ) : (
          proximas.map((e) => <FilaEntrega key={e.op.id} e={e} />)
        )}
      </section>
    </div>
  );
}

function FilaEntrega({ e }: { e: Awaited<ReturnType<typeof entregasProgramadas>>[number] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-linea py-2.5 text-sm first:border-t-0">
      <span className="num min-w-36">
        {fecha(diaArgentina(e.cuando))} · {horaArgentina(e.cuando)}
      </span>
      <Link href={`/ventas/${e.op.id}`} className="min-w-48 flex-1 font-semibold">
        {e.auto.marca} {e.auto.modelo} {e.auto.anio} {e.auto.dominio ?? ""}
        <span className="font-normal text-suave">
          {" "}
          · {e.contacto.nombre} {e.contacto.apellido ?? ""} · {e.numero}
        </span>
      </Link>
      {e.op.lugarEntrega && <span className="text-suave">{e.op.lugarEntrega}</span>}
      <ChipOperacion estado={e.op.estado} />
      {e.alarma ? (
        <ChipAlerta severidad={e.alarma.severidad}>{e.alarma.texto}</ChipAlerta>
      ) : (
        e.falta.length > 0 && <span className="text-xs text-apagado">Falta: {e.falta.join(", ")}</span>
      )}
    </div>
  );
}
