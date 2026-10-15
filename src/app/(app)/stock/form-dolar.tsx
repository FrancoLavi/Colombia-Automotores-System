"use client";

import { useActionState } from "react";
import { INICIAL } from "@/lib/form";
import { BotonEnviar } from "@/components/ui";
import { tipoCambioAccion } from "./actions";

export function FormDolar({ actual }: { actual: { fecha: string; valor: number } | null }) {
  const [r, accion] = useActionState(tipoCambioAccion, INICIAL);
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-suave">
        Dólar blue{actual ? ` (${actual.fecha}): $ ${actual.valor.toLocaleString("es-AR")}` : ": sin cargar"}
      </span>
      <label className="sr-only" htmlFor="dolar-hoy">
        Dólar blue de hoy
      </label>
      <input id="dolar-hoy" name="valor" inputMode="decimal" placeholder="Hoy" className="min-h-11 w-24 rounded-lg border border-[#c9c5ba] bg-white px-3" />
      <BotonEnviar className="btn-secundario">Guardar</BotonEnviar>
      {r.error && <span className="text-aviso-texto">{r.error}</span>}
    </form>
  );
}
