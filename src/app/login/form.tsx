"use client";

import { useActionState } from "react";
import { ingresar } from "./actions";

export function FormLogin() {
  const [estado, accion, pendiente] = useActionState(ingresar, { error: "" });
  return (
    <form action={accion} className="flex flex-col gap-4">
      <label className="campo">
        Mail
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="campo">
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {estado.error && (
        <p role="alert" className="rounded-lg bg-aviso-fondo px-3 py-2 text-sm text-aviso-texto">
          {estado.error}
        </p>
      )}
      <button className="btn-primario" disabled={pendiente}>
        {pendiente ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
