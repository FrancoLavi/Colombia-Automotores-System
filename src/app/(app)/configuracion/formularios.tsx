"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { INICIAL, type Resultado } from "@/lib/form";
import { BotonEnviar, Mensaje } from "@/components/ui";
import * as a from "./actions";

function useReset(accion: (r: Resultado, fd: FormData) => Promise<Resultado>) {
  const form = useRef<HTMLFormElement>(null);
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = await accion(prev, fd);
    if (res.ok) form.current?.reset();
    return res;
  }, INICIAL);
  return { form, r, enviar };
}

export function FormParametros({ p }: { p: { margenBase: number; umbralMargenUsd: number; diasAviso: number; diasCritico: number; diasAvisoVencimiento: number } }) {
  const [r, enviar] = useActionState(a.parametrosAccion, INICIAL);
  const pc = (n: number) => String(Math.round(n * 1000) / 10).replace(".", ",");
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="campo">
          Margen base (%)
          <input name="margenBase" inputMode="decimal" defaultValue={pc(p.margenBase)} />
        </label>
        <label className="campo">
          Alerta margen USD (%)
          <input name="umbralMargenUsd" inputMode="decimal" defaultValue={pc(p.umbralMargenUsd)} />
        </label>
        <label className="campo">
          Aviso días en stock
          <input name="diasAviso" inputMode="numeric" defaultValue={p.diasAviso} />
        </label>
        <label className="campo">
          Alerta crítica (días)
          <input name="diasCritico" inputMode="numeric" defaultValue={p.diasCritico} />
        </label>
        <label className="campo">
          Avisar vencimientos (días antes)
          <input name="diasAvisoVencimiento" inputMode="numeric" defaultValue={p.diasAvisoVencimiento} />
        </label>
      </div>
      <p className="text-xs text-apagado">
        El inversor cobra la mitad del margen base (hoy {pc(p.margenBase / 2)} % del costo). Las ventas ya cerradas no cambian.
      </p>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Guardar parámetros</BotonEnviar>
      </div>
    </form>
  );
}

export function FormObjetivo({ periodos, actuales }: { periodos: { valor: string; texto: string }[]; actuales: Record<string, { unidades: number; ganancia: number }> }) {
  const [r, enviar] = useActionState(a.objetivoAccion, INICIAL);
  const [periodo, setPeriodo] = useState(periodos[0].valor);
  const actual = actuales[periodo];
  return (
    <form action={enviar} className="flex flex-col gap-3" key={periodo}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="campo">
          Mes
          <select name="periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {periodos.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Autos a vender
          <input name="unidades" inputMode="numeric" defaultValue={actual?.unidades ?? ""} placeholder="Vacío = mitad del stock" />
        </label>
        <label className="campo">
          Ganancia ($)
          <input name="ganancia" inputMode="decimal" defaultValue={actual?.ganancia ?? ""} />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Guardar objetivo</BotonEnviar>
      </div>
    </form>
  );
}

export function FormInversor() {
  const { form, r, enviar } = useReset(a.inversorAccion);
  return (
    <form action={enviar} ref={form} className="flex flex-wrap items-end gap-2">
      <label className="campo min-w-48 flex-1">
        Nuevo inversor
        <input name="nombre" required />
      </label>
      <BotonEnviar className="btn-secundario">Agregar</BotonEnviar>
      <Mensaje r={r} />
    </form>
  );
}

export function FilaParticipe({ p }: { p: { id: number; nombre: string; tipo: string; activo: boolean; autos: number } }) {
  const [r, enviar] = useActionState(a.editarParticipeAccion.bind(null, p.id), INICIAL);
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3 border-t border-linea py-2.5">
      <label className="sr-only" htmlFor={`par-${p.id}`}>
        Nombre
      </label>
      <input id={`par-${p.id}`} name="nombre" defaultValue={p.nombre} className="min-h-11 min-w-40 flex-1 rounded-lg border border-[#c9c5ba] px-3 text-sm" />
      <span className="text-sm text-apagado">
        {p.tipo === "SALON" ? "Fondos propios" : "Inversor"} · {p.autos} {p.autos === 1 ? "auto" : "autos"}
      </span>
      {p.tipo !== "SALON" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={p.activo} className="h-5 w-5" /> Activo
        </label>
      )}
      {p.tipo === "SALON" && <input type="hidden" name="activo" value="on" />}
      <BotonEnviar className="btn-secundario">Guardar</BotonEnviar>
      {r.error && <span className="w-full text-sm text-aviso-texto">{r.error}</span>}
    </form>
  );
}

export function FormUsuario({ inversores }: { inversores: { id: number; nombre: string }[] }) {
  const { form, r, enviar } = useReset(a.usuarioAccion);
  const [rol, setRol] = useState("ADMIN");
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="campo">
          Nombre
          <input name="nombre" required />
        </label>
        <label className="campo">
          Mail
          <input name="email" type="email" required autoComplete="off" />
        </label>
        <label className="campo">
          Contraseña inicial
          <input name="password" type="text" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
        </label>
        <label className="campo">
          Acceso
          <select name="rol" value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="ADMIN">Total (socios y empleado)</option>
            <option value="INVERSOR">Inversor (solo consulta)</option>
          </select>
        </label>
        {rol === "INVERSOR" && (
          <label className="campo">
            Inversor
            <select name="participeId" required>
              {inversores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Crear usuario</BotonEnviar>
      </div>
    </form>
  );
}

export function AccionesUsuario({ id, activo, esYo }: { id: number; activo: boolean; esYo: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState("");
  const [r, enviar] = useActionState(a.resetPasswordAccion.bind(null, id), INICIAL);
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!esYo && (
        <button
          type="button"
          disabled={pendiente}
          className="btn border border-borde bg-white px-3 text-xs"
          onClick={() => iniciar(async () => setError((await a.activoUsuarioAccion(id, !activo)).error ?? ""))}
        >
          {activo ? "Desactivar" : "Activar"}
        </button>
      )}
      {!esYo &&
        (abierto ? (
          <form action={enviar} className="flex items-center gap-1.5">
            <label className="sr-only" htmlFor={`pw-${id}`}>
              Contraseña nueva
            </label>
            <input id={`pw-${id}`} name="password" type="text" minLength={8} required placeholder="Nueva (8+)" className="min-h-11 w-32 rounded-lg border border-[#c9c5ba] px-2 text-xs" />
            <BotonEnviar className="btn border border-borde bg-white px-3 text-xs" pendiente="…">
              Cambiar
            </BotonEnviar>
          </form>
        ) : (
          <button type="button" className="btn border border-borde bg-white px-3 text-xs" onClick={() => setAbierto(true)}>
            Cambiar contraseña
          </button>
        ))}
      {(error || r.error || r.mensaje) && <span className={`w-full text-right text-xs ${r.ok ? "text-ok-texto" : "text-aviso-texto"}`}>{error || r.error || r.mensaje}</span>}
    </div>
  );
}

export function FormMiPassword() {
  const { form, r, enviar } = useReset(a.miPasswordAccion);
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="campo">
          Contraseña actual
          <input name="actual" type="password" required autoComplete="current-password" />
        </label>
        <label className="campo">
          Nueva
          <input name="nueva" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label className="campo">
          Repetir nueva
          <input name="repetir" type="password" required minLength={8} autoComplete="new-password" />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-secundario ml-auto">Cambiar mi contraseña</BotonEnviar>
      </div>
    </form>
  );
}

export function FilaDocumento({ d }: { d: { id: number; nombre: string; obligatorio: boolean; tieneVencimiento: boolean; activo: boolean } }) {
  const [pendiente, iniciar] = useTransition();
  const cambiar = (campo: "obligatorio" | "tieneVencimiento" | "activo", valor: boolean) =>
    iniciar(async () => void (await a.editarDocumentoAccion(d.id, campo, valor, { obligatorio: d.obligatorio, tieneVencimiento: d.tieneVencimiento, activo: d.activo })));
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-linea py-2 text-sm ${d.activo ? "" : "opacity-50"}`}>
      <span className="min-w-48 flex-1">{d.nombre}</span>
      {(
        [
          ["obligatorio", "Obligatorio", d.obligatorio],
          ["tieneVencimiento", "Vence", d.tieneVencimiento],
          ["activo", "Activo", d.activo],
        ] as const
      ).map(([campo, texto, valor]) => (
        <label key={campo} className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={valor} disabled={pendiente} onChange={(e) => cambiar(campo, e.target.checked)} />
          {texto}
        </label>
      ))}
    </div>
  );
}

export function FormDocumento() {
  const { form, r, enviar } = useReset(a.documentoAccion);
  return (
    <form action={enviar} ref={form} className="flex flex-wrap items-end gap-3 pt-2">
      <label className="campo min-w-48 flex-1">
        Nuevo papel
        <input name="nombre" required />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="obligatorio" defaultChecked className="h-5 w-5" /> Obligatorio
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="vencimiento" className="h-5 w-5" /> Tiene vencimiento
      </label>
      <BotonEnviar className="btn-secundario">Agregar</BotonEnviar>
      <Mensaje r={r} />
    </form>
  );
}

export function FilaCategoria({ c }: { c: { id: number; nombre: string; activo: boolean } }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <label className={`flex min-h-11 items-center gap-2 border-t border-linea py-1 text-sm ${c.activo ? "" : "opacity-50"}`}>
      <input type="checkbox" className="h-5 w-5" checked={c.activo} disabled={pendiente} onChange={(e) => iniciar(async () => void (await a.activoCategoriaAccion(c.id, e.target.checked)))} />
      {c.nombre}
    </label>
  );
}

export function FormCategoria() {
  const { form, r, enviar } = useReset(a.categoriaAccion);
  return (
    <form action={enviar} ref={form} className="flex flex-wrap items-end gap-2 pt-2">
      <label className="campo min-w-40 flex-1">
        Nueva categoría
        <input name="nombre" required />
      </label>
      <BotonEnviar className="btn-secundario">Agregar</BotonEnviar>
      <Mensaje r={r} />
    </form>
  );
}
