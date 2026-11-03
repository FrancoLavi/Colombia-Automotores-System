"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ingresar, recuperar, restablecer } from "./actions";

function AvisoError({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <p role="alert" className="rounded-lg bg-aviso-fondo px-3 py-2 text-sm text-aviso-texto">
      {texto}
    </p>
  );
}

export function FormLogin({ volver }: { volver: string }) {
  const [estado, accion, pendiente] = useActionState(ingresar, { error: "" });
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="volver" value={volver} />
      <label className="campo">
        Mail
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="campo">
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <AvisoError texto={estado.error} />
      <button className="btn-primario" disabled={pendiente}>
        {pendiente ? "Ingresando…" : "Ingresar"}
      </button>
      <Link href="/login/recuperar" className="self-center text-sm font-semibold">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}

export function FormRecuperar() {
  const [estado, accion, pendiente] = useActionState(recuperar, { error: "" });
  if (estado.ok)
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg bg-ok-fondo px-3 py-3 text-sm text-ok-texto">
          Si ese mail tiene usuario, te llegó un correo con un link para elegir una contraseña nueva. Vence en 30 minutos. Revisá también la carpeta de spam.
        </p>
        <Link href="/login" className="btn-secundario">
          Volver a ingresar
        </Link>
      </div>
    );
  return (
    <form action={accion} className="flex flex-col gap-4">
      <label className="campo">
        Mail con el que ingresás
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <AvisoError texto={estado.error} />
      <button className="btn-primario" disabled={pendiente}>
        {pendiente ? "Enviando…" : "Mandarme el link"}
      </button>
      <Link href="/login" className="self-center text-sm font-semibold">
        Volver a ingresar
      </Link>
    </form>
  );
}

export function FormRestablecer({ token }: { token: string }) {
  const [estado, accion, pendiente] = useActionState(restablecer.bind(null, token), { error: "" });
  return (
    <form action={accion} className="flex flex-col gap-4">
      <label className="campo">
        Contraseña nueva
        <input name="nueva" type="password" autoComplete="new-password" minLength={8} required autoFocus />
      </label>
      <label className="campo">
        Repetila
        <input name="repetir" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <p className="-mt-2 text-xs text-apagado">Al menos 8 caracteres. Al guardarla se cierran tus sesiones abiertas en otros dispositivos.</p>
      <AvisoError texto={estado.error} />
      <button className="btn-primario" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar e ingresar"}
      </button>
    </form>
  );
}
