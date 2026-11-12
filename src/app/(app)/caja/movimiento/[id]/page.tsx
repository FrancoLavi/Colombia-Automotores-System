import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { fichaMovimiento } from "@/server/caja";
import { listarPersonas } from "@/server/configuracion";
import { fecha } from "@/lib/formato";
import { ETIQUETA_CATEGORIA } from "@/domain/caja";
import { FormAnular, FormEditarMovimiento } from "../../formularios";
import { Icono, ICONO_CATEGORIA, InsigniaMovimiento, type NombreIcono } from "@/components/iconos-caja";

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
        <div className="flex items-center gap-3">
          <InsigniaMovimiento categoria={mov.categoria} sentido={mov.sentido} anulado={mov.anulado} grande />
          <h1 className="text-3xl font-bold">{mov.concepto}</h1>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-suave">
          <span className={`num text-2xl font-semibold ${mov.anulado ? "text-apagado line-through" : ingreso ? "text-ok-texto" : "text-aviso-texto"}`}>
            {ingreso ? "+ " : "− "}
            {m(mov.importe)}
          </span>
          {mov.anulado && <span className="chip bg-aviso-fondo text-aviso-texto">Anulado{mov.motivoAnulacion ? `: ${mov.motivoAnulacion}` : ""}</span>}
          {mov.categoria !== "TRANSFERENCIA_INTERNA" && (
            <a href={`/caja/movimiento/${mov.id}/comprobante`} target="_blank" rel="noreferrer" className="btn-secundario ml-auto">
              Comprobante de {ingreso ? "cobro" : "pago"} (PDF)
            </a>
          )}
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

      <section className="tarjeta flex flex-col gap-4">
        <h2 className="text-lg font-semibold">De dónde salió</h2>
        {/* El recorrido de la plata: trámite → este movimiento → efectivo o banco. */}
        <ol className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center" aria-label="Recorrido del movimiento">
          <Paso icono={mov.origen ? origenIcono(mov.origen.href) : "lapiz"} titulo={mov.origen ? "Lo generó" : "Se cargó"} texto={mov.origen?.texto ?? "A mano, desde Caja"} href={mov.origen?.href} />
          <Flecha />
          <Paso icono={ICONO_CATEGORIA[mov.categoria] ?? "total"} titulo={ingreso ? "Entró" : "Salió"} texto={m(mov.importe)} tono={mov.anulado ? undefined : ingreso ? "ok" : "aviso"} />
          <Flecha />
          <Paso icono={mov.medio === "EFECTIVO" ? "efectivo" : "banco"} titulo={mov.anulado ? "No cuenta en" : ingreso ? "Hacia" : "Desde"} texto={mov.medio === "EFECTIVO" ? "Efectivo" : "Banco"} href={`/caja/saldo/${mov.medio === "EFECTIVO" ? "efectivo" : "banco"}`} />
        </ol>
      </section>

      {/* Por qué no se puede editar acá, y adónde ir. */}
      {!mov.editable && !mov.anulado && (
        <section className="tarjeta flex gap-4 border-info-texto/40 bg-info-fondo/40">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-info-fondo text-info-texto">
            <Icono nombre="candado" className="size-6" />
          </span>
          <div className="flex flex-col gap-2 text-sm">
            <h2 className="text-base font-semibold">¿Por qué no se puede editar acá?</h2>
            {mov.origen ? (
              <>
                <p>
                  Este movimiento lo creó el sistema solo, a partir de <b>{mov.origen.texto}</b>. Si lo cambiáramos acá, la caja diría una cosa y el trámite otra (por
                  ejemplo, el gasto del auto seguiría sumando al costo aunque acá se haya borrado).
                </p>
                <p className="text-apagado">{mov.origen.ayuda}</p>
                <Link href={mov.origen.href} className="btn-primario self-start no-underline">
                  Ir a corregirlo <Icono nombre="flecha" className="ml-1.5 size-4" />
                </Link>
              </>
            ) : mov.categoria === "TRANSFERENCIA_INTERNA" ? (
              <p>
                Es un pase entre efectivo y banco: son dos movimientos que van juntos (sale de uno y entra en el otro). Para corregirlo, anulalo abajo y cargalo de
                nuevo desde Caja.
              </p>
            ) : (
              <p>
                Lo creó el sistema a partir de otra operación. Buscala en el <Link href="/auditoria">Historial de cambios</Link> por la fecha y el importe, y corregilo
                ahí.
              </p>
            )}
          </div>
        </section>
      )}

      {mov.editable && (
        <section className="tarjeta flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icono nombre="lapiz" /> Corregir
          </h2>
          <FormEditarMovimiento mov={mov} personas={personas} />
        </section>
      )}

      {mov.deshacer && (
        <section className="tarjeta flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icono nombre="anular" /> Eliminar
          </h2>
          <p className="text-sm text-apagado">
            Se anula: deja de contar en la caja pero queda tachado en la planilla, con el motivo, para que siempre se pueda ver qué pasó.
            {mov.categoria === "TRANSFERENCIA_INTERNA" && " Al ser un pase entre efectivo y banco, se anulan las dos partes."}
            {mov.deshacer === "CUENTA" && " La cuenta vuelve a quedar abierta por este importe en Cuentas pendientes, para registrarlo de nuevo con el medio o el importe correctos."}
            {mov.deshacer === "INVERSOR" && " Lo de esta venta vuelve a quedar pendiente con el inversor en Cuentas pendientes, para registrarlo de nuevo."}
          </p>
          <FormAnular id={mov.id} />
        </section>
      )}
    </div>
  );
}

const origenIcono = (href: string): NombreIcono => (href.startsWith("/ventas") ? "venta" : href.startsWith("/stock") ? "auto" : "cuenta");

const TONO = { ok: "bg-ok-fondo text-ok-texto", aviso: "bg-aviso-fondo text-aviso-texto" };

function Paso({ icono, titulo, texto, href, tono }: { icono: NombreIcono; titulo: string; texto: string; href?: string; tono?: keyof typeof TONO }) {
  const contenido = (
    <>
      <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${tono ? TONO[tono] : "bg-fondo text-tinta"}`}>
        <Icono nombre={icono} className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-xs uppercase tracking-wider text-apagado">{titulo}</span>
        <span className="font-semibold">{texto}</span>
      </span>
    </>
  );
  return (
    <li className="flex-1">
      {href ? (
        <Link href={href} className="flex items-center gap-3 rounded-xl border border-borde p-3 text-tinta no-underline hover:border-tinta">
          {contenido}
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-borde p-3">{contenido}</div>
      )}
    </li>
  );
}

function Flecha() {
  return (
    <li aria-hidden="true" className="flex justify-center text-apagado">
      <Icono nombre="flecha" className="size-5 max-sm:rotate-90" />
    </li>
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
