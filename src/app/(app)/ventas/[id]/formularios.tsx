"use client";

import { useActionState, useRef, useState } from "react";
import { BotonConfirmar } from "@/components/dialogo";
import { InputMoneda, textoMoneda } from "@/components/input-moneda";
import { INICIAL, type Resultado } from "@/lib/form";
import { Bandera } from "@/components/banderas";
import { BotonEnviar, Mensaje } from "@/components/ui";
import { compraEnPesos } from "@/domain/negocio";
import { interpretarImporte } from "@/domain/importar";
import { hoyIso, pesos } from "@/lib/formato";
import * as a from "../actions";

function useFormReset(accion: (r: Resultado, fd: FormData) => Promise<Resultado>) {
  const form = useRef<HTMLFormElement>(null);
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = await accion(prev, fd);
    if (res.ok) form.current?.reset();
    return res;
  }, INICIAL);
  return { form, r, enviar };
}

export function FormPago({ id, faltante, haySena }: { id: number; faltante: number; haySena: boolean }) {
  const { form, r, enviar } = useFormReset(a.pagoAccion.bind(null, id));
  const [tipo, setTipo] = useState(haySena ? "EFECTIVO" : "SENIA");
  const [cobrado, setCobrado] = useState("SI");
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3 rounded-lg bg-fondo p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="campo">
          Forma de pago
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="SENIA">Seña</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CREDITO">Crédito bancario</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label className="campo">
          Importe ($)
          <InputMoneda name="importe" placeholder={faltante > 0 ? `Falta ${pesos(faltante)}` : ""} required />
        </label>
        <label className="campo">
          Fecha
          <input type="date" name="fecha" defaultValue={hoyIso()} />
        </label>
        {tipo === "CREDITO" && (
          <label className="campo">
            Banco *
            <input name="banco" list="bancos" placeholder="Provincia, Patagonia…" required />
            <datalist id="bancos">
              <option value="Provincia" />
              <option value="Patagonia" />
              <option value="Nación" />
              <option value="Galicia" />
              <option value="Santander" />
            </datalist>
          </label>
        )}
        {tipo === "SENIA" && (
          <label className="campo">
            Reserva hasta
            <input type="date" name="vence" defaultValue={hoyIso(new Date(Date.now() + 7 * 86_400_000))} />
          </label>
        )}
        {(tipo === "EFECTIVO" || tipo === "OTRO") && (
          <label className="campo">
            Medio
            <select name="medio" defaultValue="EFECTIVO">
              <option value="EFECTIVO">Efectivo</option>
              <option value="BANCO">Banco</option>
            </select>
          </label>
        )}
        {tipo === "SENIA" && (
          <label className="campo">
            Medio
            <select name="medio" defaultValue="EFECTIVO">
              <option value="EFECTIVO">Efectivo</option>
              <option value="BANCO">Banco</option>
            </select>
          </label>
        )}
        {(tipo === "EFECTIVO" || tipo === "TRANSFERENCIA" || tipo === "OTRO") && (
          <label className="campo">
            ¿Ya se cobró?
            <select name="cobradoAhora" value={cobrado} onChange={(e) => setCobrado(e.target.value)}>
              <option value="SI">Sí, entra a caja ahora</option>
              <option value="NO">No, se cobra después</option>
            </select>
          </label>
        )}
      </div>
      {tipo === "SENIA" && <p className="text-sm text-suave">La seña entra a caja y deja el auto reservado.</p>}
      {tipo === "CREDITO" && <p className="text-sm text-suave">El crédito no entra a caja: queda a cobrar hasta que el banco liquide.</p>}
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Agregar</BotonEnviar>
      </div>
    </form>
  );
}

export function FormPermuta({
  id,
  participes,
  financistaDefecto,
  tcSugerido,
  usado,
}: {
  id: number;
  participes: { id: number; nombre: string; tipo: string }[];
  financistaDefecto: number;
  tcSugerido: number | null;
  /** El usado que el cliente dijo que entrega, cargado en su ficha. Viene precompletado. */
  usado?: { marca: string | null; modelo: string | null; anio: number | null; detalle: string | null };
}) {
  const { form, r, enviar } = useFormReset(a.permutaAccion.bind(null, id));
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [valor, setValor] = useState("");
  const [tc, setTc] = useState(textoMoneda(tcSugerido));
  const nV = interpretarImporte(valor) ?? 0;
  const nT = interpretarImporte(tc) ?? 0;
  const conv = nV > 0 && nT > 0 ? compraEnPesos(nV, moneda, nT) : null;
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3 rounded-lg bg-fondo p-3">
      {(usado?.marca || usado?.modelo || usado?.anio) && (
        <p className="text-xs text-apagado">
          Precompletado con el usado que figura en la ficha del cliente
          {usado.detalle ? ` (${usado.detalle})` : ""}. Si no es ese, cambialo.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="campo">
          Patente
          <input name="dominio" autoCapitalize="characters" />
        </label>
        <label className="campo">
          Marca *
          <input name="marca" defaultValue={usado?.marca ?? ""} required />
        </label>
        <label className="campo">
          Modelo *
          <input name="modelo" defaultValue={usado?.modelo ?? ""} required />
        </label>
        <label className="campo">
          Versión
          <input name="version" />
        </label>
        <label className="campo">
          Año *
          <input name="anio" inputMode="numeric" defaultValue={usado?.anio ?? ""} required />
        </label>
        <label className="campo">
          Km
          <InputMoneda name="km" />
        </label>
        <label className="campo">
          Color
          <input name="color" />
        </label>
        <label className="campo">
          Quién financia
          <select name="participeId" defaultValue={financistaDefecto}>
            {participes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Moneda
          <span className="flex items-center gap-2">
            <Bandera moneda={moneda} />
            <select name="monedaCompra" value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </span>
        </label>
        <label className="campo">
          Valor de toma *
          <InputMoneda name="valorCompra" value={valor} onChange={setValor} required />
        </label>
        <label className="campo">
          Dólar blue fijado *
          <InputMoneda name="tcIngreso" value={tc} onChange={setTc} required />
        </label>
        <label className="campo">
          Observaciones
          <input name="observaciones" />
        </label>
      </div>
      {conv && <p className="text-sm text-suave">Cubre {pesos(conv.ars)} del precio. El usado queda en stock como &quot;por ingresar&quot; hasta tener papeles y peritaje.</p>}
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Tomar usado</BotonEnviar>
      </div>
    </form>
  );
}

export function FormPrecio({ id, precio, observaciones }: { id: number; precio: number; observaciones: string | null }) {
  const [r, enviar] = useActionState(a.precioAccion.bind(null, id), INICIAL);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <label className="campo">
        Precio de venta ($)
        <InputMoneda name="precioVenta" defaultValue={precio} required />
      </label>
      <label className="campo min-w-48 flex-1">
        Observaciones
        <input name="observaciones" defaultValue={observaciones ?? ""} />
      </label>
      <BotonEnviar className="btn-secundario">Guardar</BotonEnviar>
      <Mensaje r={r} />
    </form>
  );
}

export function FormCerrar({ id, tcSugerido, faltantes }: { id: number; tcSugerido: number | null; faltantes: string[] }) {
  const [r, enviar] = useActionState(a.cerrarAccion.bind(null, id), INICIAL);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="campo">
          Dólar blue de hoy (referencia)
          <InputMoneda name="tcVenta" defaultValue={tcSugerido} />
        </label>
        {faltantes.length > 0 ? (
          <button type="button" className="btn-primario" disabled title="Primero completá lo que falta (abajo)">
            Cerrar venta
          </button>
        ) : (
          <BotonConfirmar
            pendiente="Cerrando…"
            titulo="¿Cerrar la venta?"
            detalle={
              <>
                <p>Se congela la liquidación: la ganancia y el reparto ya no cambian, aunque después aparezcan gastos.</p>
                <p>El auto pasa a vendido y lo que falte cobrar queda en Cuentas pendientes. No se puede deshacer.</p>
              </>
            }
          >
            Cerrar venta
          </BotonConfirmar>
        )}
      </div>
      {faltantes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-aviso-texto">
          {faltantes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <Mensaje r={r} />
    </form>
  );
}

export function FormEntregar({ id, aCobrar }: { id: number; aCobrar: number }) {
  const [r, enviar] = useActionState(a.entregarAccion.bind(null, id), INICIAL);
  const ahora = new Date();
  return (
    <form action={enviar} className="flex flex-col gap-3">
      {aCobrar > 0 && <p className="text-sm text-aviso-texto">Todavía quedan {pesos(aCobrar)} a cobrar. Se puede entregar igual.</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="campo">
          Fecha de entrega
          <input type="date" name="fecha" defaultValue={hoyIso()} />
        </label>
        <label className="campo">
          Hora
          <input type="time" name="hora" defaultValue={`${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`} />
        </label>
        <BotonConfirmar
          titulo="¿Registrar la entrega?"
          detalle="Desde la fecha y hora indicadas, multas y patentes corren por cuenta del comprador. La operación queda entregada."
        >
          Registrar entrega
        </BotonConfirmar>
      </div>
      <p className="text-xs text-apagado">Desde esta fecha y hora, multas y patentes corren por cuenta del comprador.</p>
      <Mensaje r={r} />
    </form>
  );
}

export function FormCaer({ id, haySena }: { id: number; haySena: boolean }) {
  const [r, enviar] = useActionState(a.caerAccion.bind(null, id), INICIAL);
  const [sena, setSena] = useState("DEVOLVER");
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="campo sm:col-span-3">
          Motivo *
          <input name="motivo" placeholder="Ej: no le aprobaron el crédito" required />
        </label>
        {haySena && (
          <label className="campo">
            La seña
            <select name="sena" value={sena} onChange={(e) => setSena(e.target.value)}>
              <option value="DEVOLVER">Se devuelve</option>
              <option value="RETENER">Queda para el salón</option>
            </select>
          </label>
        )}
        <label className="campo">
          Devolver por
          <select name="medio" defaultValue="EFECTIVO">
            <option value="EFECTIVO">Efectivo</option>
            <option value="BANCO">Banco</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-apagado">El auto vuelve a estar disponible y el usado tomado (si había) se da de baja.</p>
      <Mensaje r={r} />
      <div>
        <BotonConfirmar
          peligro
          className="btn border border-aviso-texto text-aviso-texto hover:bg-aviso-fondo"
          titulo="¿Dar de baja la operación?"
          detalle="Se devuelven los cobros (o se retiene la seña, según elegiste), el auto vuelve a disponible y el usado tomado se da de baja. No se puede deshacer."
          confirmar="Dar de baja"
        >
          Dar de baja la operación
        </BotonConfirmar>
      </div>
    </form>
  );
}

export function FormCobrar({ id, pagoId, tipo }: { id: number; pagoId: number; tipo: string }) {
  const [r, enviar] = useActionState(a.cobrarAccion.bind(null, id, pagoId), INICIAL);
  if (r.ok) return <span className="chip bg-ok-fondo text-ok-texto">Cobrado</span>;
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-2">
      {tipo !== "CREDITO" && tipo !== "TRANSFERENCIA" && (
        <select name="medio" aria-label="Medio de cobro" defaultValue="EFECTIVO" className="min-h-11 rounded-lg border border-campo-borde px-2 text-sm">
          <option value="EFECTIVO">Efectivo</option>
          <option value="BANCO">Banco</option>
        </select>
      )}
      <BotonEnviar className="btn-secundario" pendiente="…">
        {tipo === "CREDITO" ? "El banco liquidó" : "Cobrar"}
      </BotonEnviar>
      {r.error && <span className="text-xs text-aviso-texto">{r.error}</span>}
    </form>
  );
}

/** Grilla de gastos de venta: se suman al total que paga el cliente, no al costo del auto. */
export function FormGastoVenta({ id, conceptos }: { id: number; conceptos: readonly string[] }) {
  const { form, r, enviar } = useFormReset(a.gastoVentaAccion.bind(null, id));
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="campo min-w-52 flex-1">
          Concepto
          <input name="concepto" list={`conceptos-${id}`} placeholder="Elegí o escribí" required />
          <datalist id={`conceptos-${id}`}>
            {conceptos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="campo w-40">
          Importe ($)
          <InputMoneda name="importe" required />
        </label>
        <BotonEnviar className="btn-secundario" pendiente="Sumando…">
          Sumar gasto
        </BotonEnviar>
      </div>
      <Mensaje r={r} />
    </form>
  );
}

/** Fecha, hora y lugar de entrega comprometidos. Montar con key: React 19 resetea el form. */
export function FormProgramarEntrega({ id, fecha, hora, lugar }: { id: number; fecha: string | null; hora: string | null; lugar: string | null }) {
  const [r, enviar] = useActionState(a.programarEntregaAccion.bind(null, id), INICIAL);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="campo">
          Fecha
          <input type="date" name="fecha" defaultValue={fecha ?? ""} min={fecha ? undefined : hoyIso()} />
        </label>
        <label className="campo">
          Hora
          <input type="time" name="hora" defaultValue={hora ?? "11:00"} />
        </label>
        <label className="campo min-w-48 flex-1">
          Lugar
          <input name="lugar" defaultValue={lugar ?? ""} placeholder="Salón, domicilio del cliente…" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar className="btn-secundario">{fecha ? "Cambiar entrega" : "Programar entrega"}</BotonEnviar>
        {fecha && (
          <button name="quitar" value="1" className="min-h-11 px-2 text-sm text-apagado underline hover:text-aviso-texto">
            Quitar fecha
          </button>
        )}
        <Mensaje r={r} />
      </div>
    </form>
  );
}
