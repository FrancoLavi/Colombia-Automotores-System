"use client";

import { useActionState, useRef, useState } from "react";
import { INICIAL, type Resultado } from "@/lib/form";
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
          <input name="importe" inputMode="decimal" placeholder={faltante > 0 ? `Falta ${pesos(faltante)}` : ""} required />
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
}: {
  id: number;
  participes: { id: number; nombre: string; tipo: string }[];
  financistaDefecto: number;
  tcSugerido: number | null;
}) {
  const { form, r, enviar } = useFormReset(a.permutaAccion.bind(null, id));
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [valor, setValor] = useState("");
  const [tc, setTc] = useState(tcSugerido ? String(tcSugerido) : "");
  const nV = interpretarImporte(valor) ?? 0;
  const nT = interpretarImporte(tc) ?? 0;
  const conv = nV > 0 && nT > 0 ? compraEnPesos(nV, moneda, nT) : null;
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-3 rounded-lg bg-fondo p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="campo">
          Patente
          <input name="dominio" autoCapitalize="characters" />
        </label>
        <label className="campo">
          Marca *
          <input name="marca" required />
        </label>
        <label className="campo">
          Modelo *
          <input name="modelo" required />
        </label>
        <label className="campo">
          Versión
          <input name="version" />
        </label>
        <label className="campo">
          Año *
          <input name="anio" inputMode="numeric" required />
        </label>
        <label className="campo">
          Km
          <input name="km" inputMode="numeric" />
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
          <select name="monedaCompra" value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")}>
            <option value="ARS">Pesos</option>
            <option value="USD">Dólares</option>
          </select>
        </label>
        <label className="campo">
          Valor de toma *
          <input name="valorCompra" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
        </label>
        <label className="campo">
          Dólar blue fijado *
          <input name="tcIngreso" inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} required />
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
        <input name="precioVenta" inputMode="decimal" defaultValue={precio} required />
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
          <input name="tcVenta" inputMode="decimal" defaultValue={tcSugerido ?? ""} />
        </label>
        <BotonEnviar pendiente="Cerrando…">Cerrar venta</BotonEnviar>
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
        <BotonEnviar>Registrar entrega</BotonEnviar>
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
        <BotonEnviar className="btn border border-aviso-texto text-aviso-texto hover:bg-aviso-fondo">Dar de baja la operación</BotonEnviar>
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
        <select name="medio" aria-label="Medio de cobro" defaultValue="EFECTIVO" className="min-h-11 rounded-lg border border-[#c9c5ba] px-2 text-sm">
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
