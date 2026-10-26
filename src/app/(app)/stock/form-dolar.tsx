"use client";

import { useActionState, useState, useTransition } from "react";
import { InputMoneda } from "@/components/input-moneda";
import { INICIAL } from "@/lib/form";
import { BotonEnviar } from "@/components/ui";
import { tipoCambioAccion } from "./actions";
import { actualizarDolarAccion } from "../vista-actions";

/** Dólar blue del día: se trae solo de internet (dolarapi.com); se puede actualizar o cargar a mano. */
export function FormDolar({ actual }: { actual: { fecha: string; valor: number; fuente?: string } | null }) {
  const [r, accion] = useActionState(tipoCambioAccion, INICIAL);
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={accion} className="flex flex-wrap items-center justify-end gap-2 text-sm">
        <span className="text-suave">
          Dólar blue{actual ? ` (${actual.fecha}): ` : ": sin cargar"}
          {actual && <b className="num text-tinta">$ {actual.valor.toLocaleString("es-AR")}</b>}
          {actual?.fuente === "API" && <span className="text-apagado"> · online</span>}
        </span>
        <button
          type="button"
          disabled={pendiente}
          className="btn-secundario"
          title="Consultar el blue en dolarapi.com"
          onClick={() =>
            iniciar(async () => {
              const res = await actualizarDolarAccion();
              setAviso(res.mensaje ?? res.error ?? "");
            })
          }
        >
          {pendiente ? "Consultando…" : "Actualizar online"}
        </button>
        <label className="sr-only" htmlFor="dolar-hoy">
          Cargar el dólar de hoy a mano
        </label>
        <InputMoneda id="dolar-hoy" name="valor" placeholder="A mano" className="min-h-11 w-24 rounded-lg border border-campo-borde bg-superficie px-3" />
        <BotonEnviar className="btn-secundario">Guardar</BotonEnviar>
      </form>
      {(r.error || aviso) && <span className={`text-xs ${r.error ? "text-aviso-texto" : "text-apagado"}`}>{r.error || aviso}</span>}
    </div>
  );
}
