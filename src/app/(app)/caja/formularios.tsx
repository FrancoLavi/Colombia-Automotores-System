"use client";

import { useActionState, useRef, useState } from "react";
import { BotonConfirmar } from "@/components/dialogo";
import { InputMoneda } from "@/components/input-moneda";
import { INICIAL, type Resultado } from "@/lib/form";
import { BotonEnviar, Mensaje } from "@/components/ui";
import { hoyIso, pesos } from "@/lib/formato";
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

const TIPOS = [
  { valor: "GASTO_SALON", texto: "Gasto del salón (alquiler, publicidad, mecánico…)" },
  { valor: "SUELDO", texto: "Sueldo de un empleado o socio" },
  { valor: "RETIRO_SOCIO", texto: "Retiro de un socio" },
  { valor: "INGRESO_EXTRAORDINARIO", texto: "Ingreso extraordinario (ej. saldo inicial)" },
  { valor: "APORTE", texto: "Aporte de capital (inversor o socio)" },
  { valor: "GASTO_EXTRAORDINARIO", texto: "Gasto extraordinario" },
  { valor: "TRANSFERENCIA_INTERNA", texto: "Pase entre efectivo y banco" },
  { valor: "AJUSTE", texto: "Ajuste (diferencia de caja)" },
];

type Persona = { id: number; nombre: string; rol: "SOCIO" | "EMPLEADO" };

function SelectorPersona({ personas, requerido, etiqueta = "Persona" }: { personas: Persona[]; requerido?: boolean; etiqueta?: string }) {
  return (
    <label className="campo">
      {etiqueta}
      {requerido ? " *" : ""}
      <select name="personaId" defaultValue="" required={requerido}>
        <option value="">{requerido ? "Elegí…" : "—"}</option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} ({p.rol === "SOCIO" ? "socio" : "empleado"})
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormMovimiento({ participes, personas }: { participes: { id: number; nombre: string }[]; personas: Persona[] }) {
  const { form, r, enviar } = useReset(a.movimientoAccion);
  const [tipo, setTipo] = useState("GASTO_SALON");
  const pase = tipo === "TRANSFERENCIA_INTERNA";
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="campo sm:col-span-2">
          Tipo
          <select name="categoria" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </label>
        {tipo === "AJUSTE" && (
          <label className="campo">
            Sentido
            <select name="sentido" defaultValue="EGRESO">
              <option value="INGRESO">Ingreso (sobra plata)</option>
              <option value="EGRESO">Egreso (falta plata)</option>
            </select>
          </label>
        )}
        <label className="campo">
          {pase ? "Sale de" : "Medio"}
          <select name="medio" defaultValue="EFECTIVO">
            <option value="EFECTIVO">Efectivo{pase ? " → banco" : ""}</option>
            <option value="BANCO">Banco{pase ? " → efectivo" : ""}</option>
          </select>
        </label>
        <label className="campo">
          Importe ($)
          <InputMoneda name="importe" required />
        </label>
        <label className="campo">
          Fecha
          <input type="date" name="fecha" defaultValue={hoyIso()} />
        </label>
        <label className="campo sm:col-span-2">
          Concepto {pase ? "" : "*"}
          <input name="concepto" required={!pase} placeholder={pase ? "Depósito en banco" : "Ej: alquiler octubre"} />
        </label>
        {(tipo === "SUELDO" || tipo === "RETIRO_SOCIO" || tipo === "APORTE") && (
          <SelectorPersona personas={personas} requerido={tipo === "SUELDO"} etiqueta={tipo === "SUELDO" ? "A quién" : "Socio o empleado"} />
        )}
        {tipo === "APORTE" && (
          <label className="campo">
            Inversor (si aporta un inversor)
            <select name="participeId" defaultValue="">
              <option value="">—</option>
              {participes.map((p) => (
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
        <BotonEnviar className="btn-primario ml-auto">Registrar</BotonEnviar>
      </div>
    </form>
  );
}

/** Corrige un movimiento cargado a mano (fecha, medio, importe, concepto y persona). */
export function FormEditarMovimiento({
  mov,
  personas,
}: {
  mov: { id: number; fecha: Date; medio: "EFECTIVO" | "BANCO"; importe: number; concepto: string; personaId: number | null; categoria: string };
  personas: Persona[];
}) {
  const [r, enviar] = useActionState(a.editarMovimientoAccion.bind(null, mov.id), INICIAL);
  const dia = hoyIso(mov.fecha);
  const conPersona = ["SUELDO", "RETIRO_SOCIO", "APORTE"].includes(mov.categoria);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="fechaOriginal" value={dia} />
      <input type="hidden" name="fechaHora" value={mov.fecha.toISOString()} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="campo">
          Fecha
          <input type="date" name="fecha" defaultValue={dia} required />
        </label>
        <label className="campo">
          Medio
          <select name="medio" defaultValue={mov.medio}>
            <option value="EFECTIVO">Efectivo</option>
            <option value="BANCO">Banco</option>
          </select>
        </label>
        <label className="campo">
          Importe ($)
          <InputMoneda name="importe" defaultValue={mov.importe} required />
        </label>
        {conPersona && (
          <label className="campo">
            {mov.categoria === "SUELDO" ? "A quién *" : "Socio o empleado"}
            <select name="personaId" defaultValue={mov.personaId ?? ""} required={mov.categoria === "SUELDO"}>
              <option value="">—</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.rol === "SOCIO" ? "socio" : "empleado"})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="campo sm:col-span-2">
          Concepto *
          <input name="concepto" defaultValue={mov.concepto} required />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Guardar cambios</BotonEnviar>
      </div>
    </form>
  );
}

export function FormAnular({ id }: { id: number }) {
  const [r, enviar] = useActionState(a.anularAccion.bind(null, id), INICIAL);
  const [abierto, setAbierto] = useState(false);
  if (!abierto)
    return (
      <button type="button" className="min-h-11 px-2 text-xs text-apagado underline hover:text-aviso-texto" onClick={() => setAbierto(true)}>
        Anular
      </button>
    );
  return (
    <form action={enviar} className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor={`motivo-${id}`}>
        Motivo de la anulación
      </label>
      <input id={`motivo-${id}`} name="motivo" placeholder="Motivo" required className="min-h-11 w-32 rounded-lg border border-campo-borde px-2 text-xs" />
      <BotonEnviar className="btn min-h-11 border border-aviso-texto px-2 text-xs text-aviso-texto" pendiente="…">
        Anular
      </BotonEnviar>
      {r.error && <span className="text-xs text-aviso-texto">{r.error}</span>}
    </form>
  );
}

export function FormPagarGanancia({
  id,
  importe,
  etiqueta,
  capital = false,
}: {
  id: number;
  importe: number;
  etiqueta: string;
  /** K10: devolución del capital del inversor (no es ganancia). */
  capital?: boolean;
}) {
  const [r, enviar] = useActionState(a.pagarGananciaAccion.bind(null, id), INICIAL);
  if (r.ok) return <span className="chip bg-ok-fondo text-ok-texto">Pagado</span>;
  return (
    <form action={enviar} className="flex flex-wrap items-center justify-end gap-1.5">
      <select name="medio" aria-label="Medio" defaultValue="EFECTIVO" className="min-h-11 rounded-lg border border-campo-borde px-2 text-sm">
        <option value="EFECTIVO">Efectivo</option>
        <option value="BANCO">Banco</option>
      </select>
      <BotonConfirmar
        className="btn-secundario"
        pendiente="…"
        titulo={importe < 0 ? `¿Registrar el reintegro de ${pesos(-importe)}?` : `¿${etiqueta} ${pesos(importe)}?`}
        detalle={
          importe < 0
            ? capital
              ? "El inversor se llevó en usados más de lo que tenía puesto: la diferencia entra a la caja."
              : "La pérdida que le toca al inversor entra a la caja."
            : capital
              ? "Sale de la caja por el medio elegido: se le devuelve al inversor lo que puso para comprar el auto. No cuenta como ganancia."
              : "Sale de la caja por el medio elegido y la ganancia queda marcada como pagada."
        }
      >
        {importe < 0 ? "Registrar reintegro" : etiqueta}
      </BotonConfirmar>
      {r.error && <span className="w-full text-right text-xs text-aviso-texto">{r.error}</span>}
    </form>
  );
}

export function FormCuenta() {
  const { form, r, enviar } = useReset(a.crearCuentaAccion);
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="campo">
          Tipo
          <select name="tipo" defaultValue="A_PAGAR">
            <option value="A_PAGAR">Le debemos (a pagar)</option>
            <option value="A_COBRAR">Nos deben (a cobrar)</option>
          </select>
        </label>
        <label className="campo">
          Con quién *
          <input name="contraparte" required placeholder="Arias, vendedor, banco…" />
        </label>
        <label className="campo">
          Importe ($) *
          <InputMoneda name="importe" required />
        </label>
        <label className="campo">
          Vence
          <input type="date" name="vencimiento" />
        </label>
        <label className="campo">
          Detalle
          <input name="notas" />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Registrar cuenta</BotonEnviar>
      </div>
    </form>
  );
}

export function FormPagoCuenta({ id, saldo, tipo, deVenta }: { id: number; saldo: number; tipo: "A_COBRAR" | "A_PAGAR"; deVenta: boolean }) {
  const [r, enviar] = useActionState(a.pagoCuentaAccion.bind(null, id), INICIAL);
  if (r.ok) return <span className="chip bg-ok-fondo text-ok-texto">Registrado</span>;
  return (
    <form action={enviar} className="flex flex-wrap items-center justify-end gap-1.5">
      <label className="sr-only" htmlFor={`imp-${id}`}>
        Importe
      </label>
      <InputMoneda
        id={`imp-${id}`}
        name="importe"
        defaultValue={saldo}
        readOnly={deVenta}
        title={deVenta ? "Los cobros de una venta van por el total" : undefined}
        className="min-h-11 w-32 rounded-lg border border-campo-borde px-2 font-mono text-sm"
      />
      <select name="medio" aria-label="Medio" defaultValue={tipo === "A_COBRAR" && deVenta ? "BANCO" : "EFECTIVO"} className="min-h-11 rounded-lg border border-campo-borde px-2 text-sm">
        <option value="EFECTIVO">Efectivo</option>
        <option value="BANCO">Banco</option>
      </select>
      <BotonEnviar className="btn-secundario" pendiente="…">
        {tipo === "A_COBRAR" ? "Cobrar" : "Pagar"}
      </BotonEnviar>
      {r.error && <span className="w-full text-right text-xs text-aviso-texto">{r.error}</span>}
      {!r.error && saldo > 0 && !deVenta && <span className="w-full text-right text-xs text-apagado">Podés registrar un pago parcial (saldo {pesos(saldo)})</span>}
    </form>
  );
}
