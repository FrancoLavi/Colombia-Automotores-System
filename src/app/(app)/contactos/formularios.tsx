"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { INICIAL, type Resultado } from "@/lib/form";
import { BotonEnviar, Mensaje } from "@/components/ui";
import { ETIQUETA_ACTIVIDAD, ETIQUETA_ORIGEN, type Origen, type TipoActividad } from "@/domain/contactos";
import { hoyIso } from "@/lib/formato";
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
  usadoAEntregar: string | null;
  observaciones: string | null;
  proximoContacto: string | null;
}

/** Carga rápida (HU-2.1) o edición completa. */
export function FormContacto({ id, inicial, rapido }: { id?: number; inicial?: ValoresContacto; rapido?: boolean }) {
  const accion = id ? a.editarContactoAccion.bind(null, id) : a.crearContactoAccion;
  const form = useRef<HTMLFormElement>(null);
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = await accion(prev, fd);
    if (res.ok && !id) form.current?.reset();
    return res;
  }, INICIAL);
  const duplicado = r.error?.startsWith("Ya existe un contacto con ese teléfono");

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
        <label className="campo">
          Qué busca
          <input name="productoInteres" defaultValue={inicial?.productoInteres ?? ""} placeholder="Pick-up 4x4 hasta 2020" />
        </label>
        <label className="campo">
          Usado a entregar
          <input name="usadoAEntregar" defaultValue={inicial?.usadoAEntregar ?? ""} placeholder="Ford Fiesta 2015" />
        </label>
        <label className="campo">
          Calificación crediticia ($)
          <input name="calificacionMonto" inputMode="decimal" defaultValue={inicial?.calificacionMonto ?? ""} />
        </label>
        <label className="campo">
          Banco que lo califica
          <input name="calificacionBanco" defaultValue={inicial?.calificacionBanco ?? ""} placeholder="Provincia, Patagonia…" />
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
          <label key={m} className={`btn cursor-pointer border ${modo === m ? "border-acento bg-info-fondo text-acento" : "border-borde bg-white"}`}>
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
          Nota
          <input name="nota" placeholder={modo === "AGENDAR" ? "Ej: confirmar si viene el martes" : "Ej: le pasé fotos de la Amarok"} />
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
        Resultado
        <input name="nota" placeholder="Qué pasó" />
      </label>
      <label className="campo">
        Volver a contactar
        <input type="date" name="proximoContacto" />
      </label>
      <BotonEnviar className="btn-secundario">Hecho</BotonEnviar>
      {r.error && <span className="w-full text-sm text-aviso-texto">{r.error}</span>}
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
          <input name="presupuestoMax" inputMode="decimal" />
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
          className="btn min-h-11 border border-borde bg-white px-3 text-xs"
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
        <button key={e} name="etapa" value={e} className="btn border border-borde bg-white">
          {e === "DESCARTADO" ? "Descartar" : "Reactivar"}
        </button>
      ))}
      {r.error && <span className="text-sm text-aviso-texto">{r.error}</span>}
    </form>
  );
}
