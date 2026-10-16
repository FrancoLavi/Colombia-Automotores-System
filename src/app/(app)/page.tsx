import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { tablero } from "@/server/dashboard";
import { fecha, pesos, porcentaje } from "@/lib/formato";
import { avance, nombreMes } from "@/domain/dashboard";
import { ChipAlerta } from "@/components/ui";
import { Telefono } from "./contactos/chips";
import { FormDolar } from "./stock/form-dolar";

export const metadata = { title: "Inicio · Colombia Automotores" };

function Barra({ valor, color }: { valor: number; color: string }) {
  return (
    <div className="h-2.5 rounded-full bg-linea" aria-hidden="true">
      <div className="h-2.5 rounded-full" style={{ width: `${Math.round(valor * 100)}%`, background: color }} />
    </div>
  );
}

export default async function InicioPage() {
  const u = await requerirUsuario();
  const t = await tablero();
  const maxVentas = Math.max(1, ...t.ventas12.map((m) => m.ventas));
  const agendaItems = [
    ...t.agenda.actividades.map(({ a, contacto }) => ({
      clave: `a${a.id}`,
      hora: a.fechaProgramada.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      contacto,
      detalle: a.nota ?? a.tipo.toLowerCase(),
    })),
    ...t.agenda.proximos.map((c) => ({ clave: `c${c.id}`, hora: "—", contacto: c, detalle: c.productoInteres ? `Busca ${c.productoInteres}` : "Volver a contactar" })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-apagado">{nombreMes(t.periodo).replace(/ \d+$/, "")} · stock al inicio del mes: {t.stockInicio}</p>
          <h1 className="text-3xl font-bold">Hola, {u.nombre}</h1>
        </div>
        <FormDolar actual={t.tc ? { fecha: fecha(t.tc.fecha), valor: t.tc.valor } : null} />
      </header>

      <section aria-label="Objetivos del mes" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Autos vendidos</span>
          <div>
            <span className="num text-3xl">{t.vendidos}</span>
            <span className="text-apagado"> / {t.objetivo.unidades.valor} objetivo</span>
          </div>
          <Barra valor={avance(t.vendidos, t.objetivo.unidades.valor)} color="#1f4fd1" />
          <span className="text-[13px] text-apagado">
            {t.objetivo.unidades.automatico ? "Meta automática: la mitad del stock" : "Meta cargada en configuración"} · rotación {porcentaje(t.rotacion)}
          </span>
        </div>
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Ganancia del mes</span>
          <div>
            <span className="num text-3xl">{pesos(t.ganancia)}</span>
            {t.objetivo.ganancia ? <span className="text-apagado"> / {pesos(t.objetivo.ganancia)}</span> : null}
          </div>
          {t.objetivo.ganancia ? <Barra valor={avance(t.ganancia, t.objetivo.ganancia)} color="#1e7a46" /> : null}
          <span className="text-[13px] text-apagado">
            Salón {pesos(t.gananciaSalon)} · Inversores {pesos(t.gananciaInversores)}
          </span>
        </div>
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Caja disponible</span>
          <span className={`num text-3xl ${t.patrimonio.caja.total < 0 ? "text-aviso-texto" : ""}`}>{pesos(t.patrimonio.caja.total)}</span>
          <span className="text-[13px] text-apagado">
            Efectivo {pesos(t.patrimonio.caja.efectivo)} · Banco {pesos(t.patrimonio.caja.banco)}
            {t.patrimonio.aCobrar > 0 && ` · a cobrar ${pesos(t.patrimonio.aCobrar)}`}
          </span>
          <Link href="/caja" className="text-sm font-semibold">
            Ver caja →
          </Link>
        </div>
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-apagado">Patrimonio</span>
          <span className="num text-3xl">{pesos(t.patrimonio.total)}</span>
          <span className="text-[13px] text-apagado">
            {t.stock.total} {t.stock.total === 1 ? "auto" : "autos"} en stock · {t.stock.diasPromedio} días promedio
          </span>
          <Link href="/caja" className="text-sm font-semibold">
            Ver detalle →
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="tarjeta flex flex-col" aria-label="Alertas">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-lg font-semibold">Alertas</h2>
            <span className={`chip ${t.alertas.length ? "bg-aviso-fondo text-aviso-texto" : "bg-ok-fondo text-ok-texto"}`}>
              {t.alertas.length ? `${t.alertas.length} activas` : "Todo en orden"}
            </span>
          </div>
          {t.alertas.slice(0, 10).map((a, i) => (
            <Link key={i} href={a.href} className="flex items-center gap-3 border-t border-linea py-2.5 text-sm text-tinta no-underline hover:bg-fondo">
              <ChipAlerta severidad={a.severidad}>{a.severidad === "CRITICA" ? "CRÍTICA" : a.severidad}</ChipAlerta>
              <span className="flex-1">{a.texto}</span>
            </Link>
          ))}
          {t.alertas.length > 10 && (
            <Link href="/stock" className="pt-2 text-sm font-semibold">
              Ver {t.alertas.length - 10} más en el stock →
            </Link>
          )}
        </section>

        <section className="tarjeta flex flex-col" aria-label="Agenda de hoy">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-lg font-semibold">Agenda de hoy</h2>
            <Link href="/contactos/agenda" className="text-sm font-semibold">
              Ver todo
            </Link>
          </div>
          {agendaItems.length === 0 && <p className="text-sm text-apagado">Nada agendado para hoy.</p>}
          {agendaItems.slice(0, 8).map((i) => (
            <div key={i.clave} className="flex flex-col gap-1 border-t border-linea py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-3">
                <span className="num text-apagado">{i.hora}</span>
                <Link href={`/contactos/${i.contacto.id}`} className="font-semibold text-tinta">
                  {i.contacto.nombre} {i.contacto.apellido}
                </Link>
                <Telefono telefono={i.contacto.telefono} />
              </div>
              <span className="text-suave">{i.detalle}</span>
            </div>
          ))}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="tarjeta flex flex-col gap-3" aria-label="Ventas de los últimos 12 meses">
          <h2 className="text-lg font-semibold">Ventas de los últimos 12 meses</h2>
          <div className="flex h-44 items-end gap-2 border-b border-borde" role="img" aria-label={`Ventas por mes: ${t.ventas12.map((m) => `${m.etiqueta} ${m.ventas}`).join(", ")}`}>
            {t.ventas12.map((m, i) => (
              <div key={m.periodo} className="flex h-full flex-1 flex-col justify-end">
                {m.ventas > 0 && <span className="num pb-1 text-center text-xs text-apagado">{m.ventas}</span>}
                <div className="rounded-t" style={{ height: `${(m.ventas / maxVentas) * 85}%`, background: i === t.ventas12.length - 1 ? "#8fa9f0" : "#1f4fd1" }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 text-xs text-apagado">
            {t.ventas12.map((m) => (
              <span key={m.periodo} className="flex-1 text-center">
                {m.etiqueta.slice(0, 3)}
              </span>
            ))}
          </div>
        </section>
        <section className="tarjeta flex flex-col" aria-label="Rotación por modelo">
          <h2 className="pb-2 text-lg font-semibold">Qué se vende más rápido</h2>
          {t.rotacionModelos.length === 0 && <p className="text-sm text-apagado">Se completa a medida que se cierran ventas.</p>}
          {t.rotacionModelos.map((r) => (
            <div key={r.modelo} className="flex justify-between gap-3 border-t border-linea py-2 text-sm">
              <span>
                {r.modelo} <span className="text-apagado">· {r.ventas}</span>
              </span>
              <span className={`num ${r.dias > 45 ? "text-aviso-texto" : ""}`}>{r.dias} días</span>
            </div>
          ))}
          {t.rotacionModelos.length > 0 && <span className="pt-2 text-[13px] text-apagado">Sirve para decidir a cuánto tomar cada modelo.</span>}
        </section>
      </div>
    </div>
  );
}
