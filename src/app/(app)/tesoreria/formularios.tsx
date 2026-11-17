"use client";

import { useActionState, useState } from "react";
import { BotonEnviar, ErrorLinea, Mensaje } from "@/components/ui";
import { INICIAL, type Resultado } from "@/lib/form";
import { pesos } from "@/lib/formato";
import { ETIQUETA_ESTADO, type EstadoValor } from "@/domain/valores";
import * as a from "./actions";

type Deuda = { id: number; contraparte: string; saldo: number };

/** Alta de un cheque que no viene de una venta: lo trae alguien a saldar una cuenta. */
export function FormNuevoValor({ abiertoInicial = false }: { abiertoInicial?: boolean }) {
  const [r, enviar] = useActionState(a.registrarValorAccion, INICIAL);
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [tipo, setTipo] = useState("CHEQUE");
  if (!abierto) {
    return (
      <button type="button" className="btn-primario self-start" onClick={() => setAbierto(true)}>
        + Cargar un cheque
      </button>
    );
  }
  return (
    <form action={enviar} className="tarjeta flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Cargar un valor recibido</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="campo">
          Tipo
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="CHEQUE">Cheque</option>
            <option value="PAGARE">Pagaré</option>
          </select>
        </label>
        <label className="campo">
          Importe *
          <input name="importe" inputMode="decimal" required placeholder="2.500.000" />
        </label>
        <label className="campo">
          Fecha de pago *
          <input type="date" name="fechaPago" required />
        </label>
        {tipo === "CHEQUE" && (
          <>
            <label className="campo">
              N° de cheque
              <input name="numero" placeholder="00123456" />
            </label>
            <label className="campo">
              Banco
              <input name="banco" placeholder="Banco Nación" />
            </label>
            <label className="campo">
              Fecha de emisión
              <input type="date" name="fechaEmision" />
            </label>
          </>
        )}
        <label className="campo">
          Librador (quién lo firma)
          <input name="librador" placeholder="Transportes del Sur SRL" />
        </label>
        <label className="campo">
          CUIT del librador
          <input name="libradorCuit" placeholder="30-12345678-9" />
        </label>
        <label className="campo">
          Quién lo entregó
          <input name="recibidoDe" placeholder="Si no es el mismo que lo firmó" />
        </label>
      </div>
      <label className="campo">
        Notas
        <input name="notas" placeholder="Opcional" />
      </label>
      <p className="text-sm text-suave">
        El plazo para depositarlo se cuenta desde la <b>fecha de pago</b>, no desde la de emisión. Queda como plata a
        cobrar hasta que el banco lo acredite: no entra a la caja antes.
      </p>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
          <BotonEnviar>Cargar</BotonEnviar>
        </div>
      </div>
    </form>
  );
}

/** Los botones de una fila: depende del estado en el que esté el valor. */
export function AccionesValor({
  id,
  estado,
  depositable,
  sinCuenta,
  importe,
  deudas,
}: {
  id: number;
  estado: EstadoValor;
  depositable: boolean;
  sinCuenta: boolean;
  importe: number;
  deudas: Deuda[];
}) {
  const [panel, setPanel] = useState<"" | "acreditar" | "endosar" | "rechazar" | "incobrable">("");
  if (estado === "ACREDITADO" || estado === "ENDOSADO" || estado === "INCOBRABLE") {
    return <span className="text-sm text-apagado">—</span>;
  }
  if (sinCuenta) {
    return <span className="text-sm text-apagado">La venta todavía no se cerró</span>;
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {estado === "EN_CARTERA" && <BotonSimple etiqueta="Depositar" accion={() => a.depositarAccion(id)} deshabilitado={!depositable} />}
        {estado === "DEPOSITADO" && <Chip onClick={() => setPanel(panel === "acreditar" ? "" : "acreditar")}>Acreditó</Chip>}
        {estado === "EN_CARTERA" && deudas.length > 0 && <Chip onClick={() => setPanel(panel === "endosar" ? "" : "endosar")}>Endosar</Chip>}
        {estado === "RECHAZADO" && <BotonSimple etiqueta="Vuelve a cartera" accion={() => a.volverACarteraAccion(id)} />}
        {estado !== "RECHAZADO" && <Chip onClick={() => setPanel(panel === "rechazar" ? "" : "rechazar")}>Rebotó</Chip>}
        <Chip onClick={() => setPanel(panel === "incobrable" ? "" : "incobrable")}>Dar por perdido</Chip>
      </div>
      {panel === "acreditar" && <PanelMedio id={id} cerrar={() => setPanel("")} />}
      {panel === "endosar" && <PanelEndoso id={id} importe={importe} deudas={deudas} cerrar={() => setPanel("")} />}
      {panel === "rechazar" && <PanelMotivo id={id} accion={a.rechazarAccion} etiqueta="Por qué rebotó" boton="Marcar rechazado" cerrar={() => setPanel("")} />}
      {panel === "incobrable" && (
        <PanelMotivo
          id={id}
          accion={a.incobrableAccion}
          etiqueta="Por qué se da por perdido"
          boton="Confirmar pérdida"
          aviso={`Se van a descontar ${pesos(importe)} del patrimonio. Hasta ahora seguía contando como algo por cobrar.`}
          cerrar={() => setPanel("")}
        />
      )}
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="chip border border-borde bg-superficie px-2.5 py-1.5 text-[13px]">
      {children}
    </button>
  );
}

function BotonSimple({ etiqueta, accion, deshabilitado = false }: { etiqueta: string; accion: () => Promise<Resultado>; deshabilitado?: boolean }) {
  const [r, enviar, pendiente] = useActionState(accion, INICIAL);
  return (
    <form action={enviar} className="flex flex-col items-end">
      <button
        type="submit"
        disabled={pendiente || deshabilitado}
        title={deshabilitado ? "Todavía no llegó la fecha de pago, o se pasó el plazo" : undefined}
        className="chip border border-borde bg-superficie px-2.5 py-1.5 text-[13px] disabled:opacity-40"
      >
        {pendiente ? "…" : etiqueta}
      </button>
      <ErrorLinea r={r} />
    </form>
  );
}

function PanelMedio({ id, cerrar }: { id: number; cerrar: () => void }) {
  const [r, enviar] = useActionState(a.acreditarAccion.bind(null, id), INICIAL);
  return (
    <form action={enviar} className="flex flex-col gap-2 rounded-lg border border-borde bg-superficie p-3 text-sm">
      <label className="campo">
        ¿A dónde entró la plata?
        <select name="medio" defaultValue="BANCO">
          <option value="BANCO">Banco</option>
          <option value="EFECTIVO">Efectivo</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={cerrar}>
          Cancelar
        </button>
        <BotonEnviar className="btn-primario">Acreditar</BotonEnviar>
      </div>
      <ErrorLinea r={r} />
    </form>
  );
}

function PanelEndoso({ id, importe, deudas, cerrar }: { id: number; importe: number; deudas: Deuda[]; cerrar: () => void }) {
  const [r, enviar] = useActionState(a.endosarAccion.bind(null, id), INICIAL);
  const alcanzan = deudas.filter((d) => d.saldo >= importe);
  return (
    <form action={enviar} className="flex w-72 flex-col gap-2 rounded-lg border border-borde bg-superficie p-3 text-sm">
      <label className="campo">
        ¿Qué deuda cancela?
        <select name="cuentaPagarId" defaultValue="">
          <option value="">Elegí una</option>
          {alcanzan.map((d) => (
            <option key={d.id} value={d.id}>
              {d.contraparte} · {pesos(d.saldo)}
            </option>
          ))}
        </select>
      </label>
      {alcanzan.length === 0 && (
        <p className="text-aviso-texto">No hay deudas de {pesos(importe)} o más. Un cheque se endosa entero.</p>
      )}
      <p className="text-suave">El endoso no pasa por la caja: cancela la deuda directamente.</p>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={cerrar}>
          Cancelar
        </button>
        <BotonEnviar className="btn-primario">Endosar</BotonEnviar>
      </div>
      <ErrorLinea r={r} />
    </form>
  );
}

function PanelMotivo({
  id, accion, etiqueta, boton, aviso, cerrar,
}: {
  id: number;
  accion: (id: number, estado: Resultado, fd: FormData) => Promise<Resultado>;
  etiqueta: string;
  boton: string;
  aviso?: string;
  cerrar: () => void;
}) {
  const [r, enviar] = useActionState(accion.bind(null, id), INICIAL);
  return (
    <form action={enviar} className="flex w-72 flex-col gap-2 rounded-lg border border-borde bg-superficie p-3 text-sm">
      {aviso && <p className="rounded-lg bg-aviso-fondo p-2 text-aviso-texto">{aviso}</p>}
      <label className="campo">
        {etiqueta} *
        <input name="motivo" required placeholder="Queda en el historial" />
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={cerrar}>
          Cancelar
        </button>
        <BotonEnviar className="btn-primario">{boton}</BotonEnviar>
      </div>
      <ErrorLinea r={r} />
    </form>
  );
}

export { ETIQUETA_ESTADO };
