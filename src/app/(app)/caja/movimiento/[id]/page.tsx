import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { fichaMovimiento } from "@/server/caja";
import { listarPersonas } from "@/server/configuracion";
import { fecha } from "@/lib/formato";
import { ETIQUETA_CATEGORIA } from "@/domain/caja";
import { FormAnular, FormEditarMovimiento } from "../../formularios";

export const metadata = { title: "Movimiento · Caja · Colombia Automotores" };

// Ficha de un movimiento de caja: qué es, de dónde salió y cómo se corrige.
export default async function MovimientoPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [mov, personas, { m }] = await Promise.all([fichaMovimiento(id), listarPersonas(true), vistaMoneda()]);
  if (!mov) notFound();
  const ingreso = mov.sentido === "INGRESO";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link href={`/caja/saldo/${mov.medio === "EFECTIVO" ? "efectivo" : "banco"}`} className="text-sm">
          ← Volver a {mov.medio === "EFECTIVO" ? "Efectivo" : "Banco"}
        </Link>
        <h1 className="text-3xl font-bold">{mov.concepto}</h1>
        <p className="flex flex-wrap items-center gap-2 text-suave">
          <span className={`num text-2xl font-semibold ${mov.anulado ? "text-apagado line-through" : ingreso ? "text-ok-texto" : "text-aviso-texto"}`}>
            {ingreso ? "+ " : "− "}
            {m(mov.importe)}
          </span>
          {mov.anulado && <span className="chip bg-aviso-fondo text-aviso-texto">Anulado{mov.motivoAnulacion ? `: ${mov.motivoAnulacion}` : ""}</span>}
        </p>
      </header>

      <section className="tarjeta grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Dato etiqueta="Fecha" valor={fecha(mov.fecha)} />
        <Dato etiqueta="Tipo" valor={ETIQUETA_CATEGORIA[mov.categoria]} />
        <Dato etiqueta="Medio" valor={mov.medio === "EFECTIVO" ? "Efectivo" : "Banco"} />
        <Dato etiqueta="Sentido" valor={ingreso ? "Entró plata" : "Salió plata"} />
        {mov.persona && <Dato etiqueta="Persona" valor={mov.persona} />}
        {mov.participe && <Dato etiqueta="Inversor / dueño" valor={mov.participe} />}
        <Dato etiqueta="Lo cargó" valor={mov.usuario ?? "—"} />
        <Dato etiqueta="N° de movimiento" valor={String(mov.id)} />
      </section>

      <section className="tarjeta flex flex-col gap-3">
        <h2 className="text-lg font-semibold">De dónde salió</h2>
        {mov.origen ? (
          <>
            <p className="text-sm">
              Lo generó: <Link href={mov.origen.href} className="font-semibold">{mov.origen.texto} →</Link>
            </p>
            <p className="text-sm text-apagado">{mov.origen.ayuda} Así el movimiento y su origen nunca quedan distintos.</p>
          </>
        ) : (
          <p className="text-sm">Se cargó a mano desde Caja.</p>
        )}
      </section>

      {mov.editable && (
        <section className="tarjeta flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Corregir</h2>
          <FormEditarMovimiento mov={mov} personas={personas} />
        </section>
      )}

      {mov.manual && !mov.anulado && (
        <section className="tarjeta flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Eliminar</h2>
          <p className="text-sm text-apagado">
            Se anula: deja de contar en la caja pero queda tachado en la planilla, con el motivo, para que siempre se pueda ver qué pasó.
            {mov.categoria === "TRANSFERENCIA_INTERNA" && " Al ser un pase entre efectivo y banco, se anulan las dos partes."}
          </p>
          <FormAnular id={mov.id} />
        </section>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-linea py-1.5">
      <span className="text-apagado">{etiqueta}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}
