"use client";

import { useActionState, useId, useRef, useState, useTransition } from "react";
import { InputMoneda } from "@/components/input-moneda";
import { INICIAL, type Resultado } from "@/lib/form";
import { BotonEnviar, Mensaje } from "@/components/ui";
import { ETIQUETA_ACTIVIDAD, ETIQUETA_ORIGEN, type Origen, type TipoActividad } from "@/domain/contactos";
import { hoyIso, ZONA } from "@/lib/formato";
import * as a from "./actions";

export interface ValoresContacto {
  nombre: string;
  apellido: string | null;
  dniCuit: string | null;
  telefono: string | null;
  email: string | null;
  localidad: string | null;
  origen: Origen;
  calificacionMonto: number | null;
  calificacionBanco: string | null;
  productoInteres: string | null;
  usadoMarca: string | null;
  usadoModelo: string | null;
  usadoAnio: number | null;
  usadoAEntregar: string | null;
  observaciones: string | null;
  proximoContacto: string | null;
}

/** Carga rápida (HU-2.1) o edición completa. */
export function FormContacto({ id, inicial, rapido, bancos = [], marcas = [] }: { id?: number; inicial?: ValoresContacto; rapido?: boolean; bancos?: string[]; marcas?: string[] }) {
  const accion = id ? a.editarContactoAccion.bind(null, id) : a.crearContactoAccion;
  const form = useRef<HTMLFormElement>(null);
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = await accion(prev, fd);
    if (res.ok && !id) form.current?.reset();
    return res;
  }, INICIAL);
  const duplicado = r.error?.startsWith("Ya existe un contacto con ese teléfono");
  // Un banco ya cargado que no esté en la lista (o que la hayan desactivado) no se puede perder:
  // arranca en "Otro" con el texto a la vista.
  const bancoInicial = inicial?.calificacionBanco ?? "";
  const [bancoOtro, setBancoOtro] = useState(!!bancoInicial && !bancos.includes(bancoInicial));

  return (
    <form action={enviar} ref={form} className="flex flex-col gap-4">
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="campo">
          Nombre *
          <input name="nombre" defaultValue={inicial?.nombre} required />
        </label>
        <label className="campo">
          Apellido
          <input name="apellido" defaultValue={inicial?.apellido ?? ""} />
        </label>
        <label className="campo">
          Teléfono
          <input name="telefono" type="tel" defaultValue={inicial?.telefono ?? ""} placeholder="291 555-0142" />
        </label>
        <label className="campo">
          De dónde vino
          <select name="origen" defaultValue={inicial?.origen ?? "WHATSAPP"}>
            {(Object.keys(ETIQUETA_ORIGEN) as Origen[]).map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_ORIGEN[o]}
              </option>
            ))}
          </select>
        </label>
        {id ? (
          // Al editar, lo que busca se administra con los pedidos de la ficha; acá solo
          // queda a la vista lo que se haya escrito a mano antes de que existiera el pedido.
          inicial?.productoInteres ? (
            <label className="campo">
              Qué busca (texto viejo)
              <input name="productoInteres" defaultValue={inicial.productoInteres} />
            </label>
          ) : null
        ) : (
          <>
            <label className="campo">
              Qué busca · marca
              <input name="pedidoMarca" list="marcas-contacto" placeholder="Volkswagen" />
              <datalist id="marcas-contacto">
                {marcas.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </label>
            <label className="campo">
              Qué busca · modelo
              <input name="pedidoModelo" placeholder="Amarok" />
            </label>
            <label className="campo">
              Años (desde / hasta)
              <span className="flex gap-2">
                <input name="pedidoAnioDesde" inputMode="numeric" placeholder="2018" />
                <input name="pedidoAnioHasta" inputMode="numeric" placeholder="2022" />
              </span>
            </label>
            <label className="campo">
              Presupuesto máx. ($)
              <InputMoneda name="pedidoPresupuesto" />
            </label>
          </>
        )}
        <label className="campo">
          Usado · marca
          <input name="usadoMarca" defaultValue={inicial?.usadoMarca ?? ""} placeholder="Ford" />
        </label>
        <label className="campo">
          Usado · modelo
          <input name="usadoModelo" defaultValue={inicial?.usadoModelo ?? ""} placeholder="Fiesta" />
        </label>
        <label className="campo">
          Usado · año
          <input name="usadoAnio" inputMode="numeric" defaultValue={inicial?.usadoAnio ?? ""} placeholder="2015" />
        </label>
        <label className="campo">
          Detalle del usado
          <input name="usadoAEntregar" defaultValue={inicial?.usadoAEntregar ?? ""} placeholder="Con granizo, motor hecho…" />
        </label>
        <label className="campo">
          Calificación crediticia ($)
          <InputMoneda name="calificacionMonto" defaultValue={inicial?.calificacionMonto} />
        </label>
        <label className="campo">
          Banco que lo califica
          <select
            name={bancoOtro ? "bancoElegido" : "calificacionBanco"}
            defaultValue={bancoOtro ? "__OTRO__" : bancoInicial}
            onChange={(e) => setBancoOtro(e.target.value === "__OTRO__")}
          >
            <option value="">—</option>
            {bancos.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            <option value="__OTRO__">Otro…</option>
          </select>
          {bancoOtro && (
            <input name="calificacionBanco" defaultValue={bancoInicial} required placeholder="Nombre del banco" className="mt-1.5" />
          )}
        </label>
        <label className="campo">
          Próximo contacto
          <input name="proximoContacto" type="date" defaultValue={inicial?.proximoContacto ?? ""} />
        </label>
        {!rapido && (
          <>
            <label className="campo">
              DNI / CUIT
              <input name="dniCuit" defaultValue={inicial?.dniCuit ?? ""} />
            </label>
            <label className="campo">
              Mail
              <input name="email" type="email" defaultValue={inicial?.email ?? ""} />
            </label>
            <label className="campo">
              Localidad
              <input name="localidad" defaultValue={inicial?.localidad ?? ""} />
            </label>
          </>
        )}
        <label className={`campo ${rapido ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2 lg:col-span-4"}`}>
          Observaciones
          <input name="observaciones" defaultValue={inicial?.observaciones ?? ""} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Mensaje r={r} />
        <div className="ml-auto flex flex-wrap gap-2">
          {duplicado && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ignorarDuplicado" value="1" className="h-5 w-5" /> Cargar igual
            </label>
          )}
          {!id && (
            <button name="seguir" value="1" className="btn-secundario">
              Guardar y cargar otro
            </button>
          )}
          <BotonEnviar>{id ? "Guardar cambios" : "Guardar"}</BotonEnviar>
        </div>
      </div>
    </form>
  );
}

export function FormActividad({ contactoId }: { contactoId: number }) {
  const form = useRef<HTMLFormElement>(null);
  const [modo, setModo] = useState<"REGISTRAR" | "AGENDAR">("REGISTRAR");
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = await a.actividadAccion(contactoId, prev, fd);
    if (res.ok) form.current?.reset();
    return res;
  }, INICIAL);
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3 rounded-lg bg-fondo p-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Qué querés hacer">
        {(["REGISTRAR", "AGENDAR"] as const).map((m) => (
          <label key={m} className={`btn cursor-pointer border ${modo === m ? "border-acento bg-info-fondo text-acento" : "border-borde bg-superficie"}`}>
            <input type="radio" name="modo" value={m} checked={modo === m} onChange={() => setModo(m)} className="sr-only" />
            {m === "REGISTRAR" ? "Registrar contacto hecho" : "Agendar para después"}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="campo">
          Tipo
          <select name="tipo" defaultValue="WHATSAPP">
            {(Object.keys(ETIQUETA_ACTIVIDAD) as TipoActividad[]).map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_ACTIVIDAD[t]}
              </option>
            ))}
          </select>
        </label>
        {modo === "AGENDAR" ? (
          <>
            <label className="campo">
              Fecha
              <input type="date" name="fecha" defaultValue={hoyIso(new Date(Date.now() + 86_400_000))} required />
            </label>
            <label className="campo">
              Hora
              <input type="time" name="hora" defaultValue="10:00" />
            </label>
          </>
        ) : (
          <label className="campo">
            Próximo contacto
            <input type="date" name="proximoContacto" />
          </label>
        )}
        <label className="campo sm:col-span-2 lg:col-span-4">
          Nota *
          <input name="nota" required placeholder={modo === "AGENDAR" ? "Ej: confirmar si viene el martes" : "Ej: le pasé fotos de la Amarok"} />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">{modo === "AGENDAR" ? "Agendar" : "Registrar"}</BotonEnviar>
      </div>
    </form>
  );
}

/** Marca hecha una actividad (o resuelve un "próximo contacto") y reprograma. */
export function FormCompletar({ actividadId, contactoId }: { actividadId: number | null; contactoId: number }) {
  const [r, enviar] = useActionState(a.completarAccion.bind(null, actividadId, contactoId), INICIAL);
  if (r.ok) return <span className="chip bg-ok-fondo text-ok-texto">Hecho</span>;
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2">
      <label className="campo min-w-40 flex-1">
        Resultado{!actividadId && " *"}
        {/* Sin actividad agendada esto crea un seguimiento nuevo, que no puede quedar sin nota. */}
        <input name="nota" required={!actividadId} placeholder="Qué pasó" />
      </label>
      <BotonEnviar className="btn-secundario">Hecho</BotonEnviar>
      {r.error && <span className="w-full text-sm text-aviso-texto">{r.error}</span>}
    </form>
  );
}

/** Hora "HH:MM" en hora argentina, para precargar un input type="time". */
const horaArgentina = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

type Cita =
  | { clase: "actividad"; id: number; tipo: TipoActividad; fechaProgramada: Date; nota: string | null }
  | { clase: "proximo"; dia: string };

/**
 * HU-2.3: editar o eliminar una cita. Una actividad agendada se edita entera (tipo, fecha, hora y
 * nota); el "volver a contactar" es solo una fecha del contacto.
 */
export function EditarCita({ contactoId, cita }: { contactoId: number; cita: Cita }) {
  const [abierto, setAbierto] = useState(false);
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = cita.clase === "actividad" ? await a.editarCitaAccion(cita.id, contactoId, prev, fd) : await a.editarProximoAccion(contactoId, prev, fd);
    if (res.ok) setAbierto(false);
    return res;
  }, INICIAL);
  const [borrando, iniciar] = useTransition();
  const [errorBorrar, setErrorBorrar] = useState<string>();

  const eliminar = () => {
    const que = cita.clase === "actividad" ? "esta cita" : "el volver a contactar";
    if (!confirm(`¿Eliminar ${que}? No se puede deshacer (queda registrado en el historial).`)) return;
    iniciar(async () => {
      const res = cita.clase === "actividad" ? await a.eliminarCitaAccion(cita.id, contactoId) : await a.quitarProximoAccion(contactoId);
      setErrorBorrar(res.ok ? undefined : res.error);
    });
  };

  if (!abierto)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secundario" onClick={() => setAbierto(true)}>
          Editar
        </button>
        {r.ok && r.mensaje && <span className="text-sm text-ok-texto">{r.mensaje}</span>}
      </div>
    );

  return (
    <form action={enviar} className="flex flex-col gap-3 rounded-lg bg-fondo p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cita.clase === "actividad" ? (
          <>
            <label className="campo">
              Tipo
              <select name="tipo" defaultValue={cita.tipo}>
                {(Object.keys(ETIQUETA_ACTIVIDAD) as TipoActividad[]).map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_ACTIVIDAD[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Fecha
              <input type="date" name="fecha" defaultValue={hoyIso(cita.fechaProgramada)} required />
            </label>
            <label className="campo">
              Hora
              <input type="time" name="hora" defaultValue={horaArgentina(cita.fechaProgramada)} />
            </label>
            <label className="campo sm:col-span-2 lg:col-span-4">
              Nota *
              <input name="nota" required defaultValue={cita.nota ?? ""} />
            </label>
          </>
        ) : (
          <label className="campo">
            Volver a contactar el
            <input type="date" name="fecha" defaultValue={cita.dia} required />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BotonEnviar className="btn-primario">Guardar</BotonEnviar>
        <button type="button" className="btn-secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
        <button type="button" className="btn ml-auto text-sm text-aviso-texto" onClick={eliminar} disabled={borrando}>
          {borrando ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
      {(r.error || errorBorrar) && <span className="text-sm text-aviso-texto">{r.error ?? errorBorrar}</span>}
    </form>
  );
}

export function FormPedido({ contactoId, marcas }: { contactoId: number; marcas: string[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = await a.pedidoAccion(contactoId, prev, fd);
    if (res.ok) form.current?.reset();
    return res;
  }, INICIAL);
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3 rounded-lg bg-fondo p-3">
      <datalist id="marcas-pedido">
        {marcas.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="campo">
          Marca
          <input name="marca" list="marcas-pedido" />
        </label>
        <label className="campo">
          Modelo
          <input name="modelo" placeholder="Amarok, Hilux…" />
        </label>
        <label className="campo">
          Año desde
          <input name="anioDesde" inputMode="numeric" />
        </label>
        <label className="campo">
          Año hasta
          <input name="anioHasta" inputMode="numeric" />
        </label>
        <label className="campo">
          Presupuesto máx. ($)
          <InputMoneda name="presupuestoMax" />
        </label>
        <label className="campo sm:col-span-2 lg:col-span-5">
          Notas
          <input name="notas" placeholder="Color, caja automática, etc." />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Registrar pedido</BotonEnviar>
      </div>
    </form>
  );
}

export interface ValoresPedido {
  id: number;
  marca: string | null;
  modelo: string | null;
  anioDesde: number | null;
  anioHasta: number | null;
  presupuestoMax: number | null;
  notas: string | null;
}

/** HU-2.4: formulario para corregir o eliminar un pedido. `alCerrar` se llama al guardar o cancelar. */
function FormEditarPedido({ contactoId, pedido, marcas, alCerrar }: { contactoId: number; pedido: ValoresPedido; marcas: string[]; alCerrar: (mensaje?: string) => void }) {
  const lista = useId();
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = await a.editarPedidoAccion(pedido.id, contactoId, prev, fd);
    if (res.ok) alCerrar(res.mensaje);
    return res;
  }, INICIAL);
  const [borrando, iniciar] = useTransition();
  const [errorBorrar, setErrorBorrar] = useState<string>();

  const eliminar = () => {
    if (!confirm("¿Eliminar este pedido? No se puede deshacer (queda registrado en el historial).")) return;
    iniciar(async () => {
      const res = await a.eliminarPedidoAccion(pedido.id, contactoId);
      setErrorBorrar(res.ok ? undefined : res.error);
    });
  };

  return (
    <form action={enviar} className="flex flex-col gap-3 rounded-lg bg-fondo p-3 text-left">
      <datalist id={lista}>
        {marcas.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="campo">
          Marca
          <input name="marca" list={lista} defaultValue={pedido.marca ?? ""} />
        </label>
        <label className="campo">
          Modelo
          <input name="modelo" defaultValue={pedido.modelo ?? ""} placeholder="Amarok, Hilux…" />
        </label>
        <label className="campo">
          Año desde
          <input name="anioDesde" inputMode="numeric" defaultValue={pedido.anioDesde ?? ""} />
        </label>
        <label className="campo">
          Año hasta
          <input name="anioHasta" inputMode="numeric" defaultValue={pedido.anioHasta ?? ""} />
        </label>
        <label className="campo">
          Presupuesto máx. ($)
          <InputMoneda name="presupuestoMax" defaultValue={pedido.presupuestoMax} />
        </label>
        <label className="campo sm:col-span-2 lg:col-span-5">
          Notas
          <input name="notas" defaultValue={pedido.notas ?? ""} placeholder="Color, caja automática, etc." />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BotonEnviar className="btn-primario">Guardar</BotonEnviar>
        <button type="button" className="btn-secundario" onClick={() => alCerrar()}>
          Cancelar
        </button>
        <button type="button" className="btn ml-auto text-sm text-aviso-texto" onClick={eliminar} disabled={borrando}>
          {borrando ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
      {(r.error || errorBorrar) && <span className="text-sm text-aviso-texto">{r.error ?? errorBorrar}</span>}
    </form>
  );
}

/** Botón "Editar" que despliega el formulario del pedido (ficha del contacto). */
export function EditarPedido({ contactoId, pedido, marcas }: { contactoId: number; pedido: ValoresPedido; marcas: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string>();
  if (abierto)
    return (
      <FormEditarPedido
        contactoId={contactoId}
        pedido={pedido}
        marcas={marcas}
        alCerrar={(m) => {
          setAviso(m);
          setAbierto(false);
        }}
      />
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn min-h-11 border border-borde bg-superficie px-3 text-xs" onClick={() => setAbierto(true)}>
        Editar
      </button>
      {aviso && <span className="text-sm text-ok-texto">{aviso}</span>}
    </div>
  );
}

/**
 * Fila de la tabla de pedidos con su botón "Editar". El formulario se abre en una ventana encima:
 * la tabla puede ser más ancha que la pantalla y adentro quedaría cortado.
 */
export function FilaPedido({ contactoId, pedido, marcas, children }: { contactoId: number; pedido: ValoresPedido; marcas: string[]; children: React.ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => {
    dialogo.current?.close();
    setAbierto(false);
  };
  return (
    <tr>
      {children}
      <td>
        <button
          type="button"
          className="btn min-h-11 border border-borde bg-superficie px-3 text-xs"
          onClick={() => {
            setAbierto(true);
            dialogo.current?.showModal();
          }}
        >
          Editar
        </button>
        <dialog
          ref={dialogo}
          onClose={() => setAbierto(false)}
          aria-label="Editar pedido"
          className="m-auto w-[min(56rem,calc(100vw-2rem))] whitespace-normal rounded-xl border border-borde bg-superficie p-4 text-tinta backdrop:bg-black/40"
        >
          <h2 className="pb-3 text-lg font-semibold">Editar pedido</h2>
          {/* Se monta al abrir, así cada vez arranca con los valores guardados. */}
          {abierto && <FormEditarPedido contactoId={contactoId} pedido={pedido} marcas={marcas} alCerrar={cerrar} />}
        </dialog>
      </td>
    </tr>
  );
}

export function BotonesPedido({ contactoId, pedidoId, estado }: { contactoId: number; pedidoId: number; estado: "ABIERTO" | "CUMPLIDO" | "DESCARTADO" }) {
  const [pendiente, iniciar] = useTransition();
  const opciones = estado === "ABIERTO" ? (["CUMPLIDO", "DESCARTADO"] as const) : (["ABIERTO"] as const);
  return (
    <span className="flex flex-wrap gap-1.5">
      {opciones.map((e) => (
        <button
          key={e}
          type="button"
          disabled={pendiente}
          className="btn min-h-11 border border-borde bg-superficie px-3 text-xs"
          onClick={() => iniciar(async () => void (await a.estadoPedidoAccion(contactoId, pedidoId, e)))}
        >
          {e === "CUMPLIDO" ? "Cumplido" : e === "DESCARTADO" ? "Descartar" : "Reabrir"}
        </button>
      ))}
    </span>
  );
}

export function AccionesEtapa({ id, opciones }: { id: number; opciones: ("DATO" | "DESCARTADO")[] }) {
  const [r, enviar] = useActionState(a.etapaAccion.bind(null, id), INICIAL);
  if (!opciones.length) return null;
  return (
    <form action={enviar} className="flex items-center gap-2">
      {opciones.map((e) => (
        <button key={e} name="etapa" value={e} className="btn border border-borde bg-superficie">
          {e === "DESCARTADO" ? "Descartar" : "Reactivar"}
        </button>
      ))}
      {r.error && <span className="text-sm text-aviso-texto">{r.error}</span>}
    </form>
  );
}
