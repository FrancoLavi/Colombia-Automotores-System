"use client";

import { useActionState, useState } from "react";
import { InputMoneda, textoMoneda } from "@/components/input-moneda";
import { INICIAL, type Resultado } from "@/lib/form";
import { Bandera } from "@/components/banderas";
import { BotonEnviar, Mensaje } from "@/components/ui";
import { BotonConfirmar } from "@/components/dialogo";
import { efectoCambioFinancista } from "@/domain/caja";
import { compraEnPesos, precioSugerido } from "@/domain/negocio";
import { interpretarImporte } from "@/domain/importar";
import { nombreContacto, pesos, usd, hoyIso } from "@/lib/formato";
import { ETIQUETA_UBICACION, type Ubicacion } from "@/domain/stock";

type Participe = { id: number; nombre: string; tipo: "SALON" | "INVERSOR" };
type Contacto = { id: number; nombre: string; apellido: string | null };

export interface InicialVehiculo {
  dominio: string | null;
  chasis: string | null;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  km: number | null;
  color: string | null;
  combustible: string | null;
  transmision: string | null;
  tipoIngreso: "COMPRA" | "PERMUTA" | "CONSIGNACION";
  participeId: number;
  ingresadoPor: string | null;
  contactoOrigenId: number | null;
  fechaIngreso: string;
  monedaCompra: "ARS" | "USD";
  valorCompraUsd: number | null;
  valorCompraArs: number;
  tcIngreso: number;
  ubicacion: Ubicacion;
  observaciones: string | null;
  prendado: boolean;
  prendaDetalle: string | null;
}

/** K15: lo que hace falta para avisar qué pasa si se cambia quién financia. */
export interface DatosCambioFinancia {
  /** Lo que tiene puesto hoy el que lo financia. */
  puesto: number;
  permutaPendiente: boolean;
  /** Lo que el salón todavía le debe al vendedor. */
  saldoCompra: number;
  enStock: boolean;
}

const MARCAS_SUGERIDAS = ["Volkswagen", "Ford", "Renault", "Peugeot", "Fiat", "Chevrolet", "Toyota", "Citroën", "Honda", "Nissan", "Chery", "Jeep"];

export function VehiculoForm({
  accion,
  participes,
  contactos,
  marcas,
  inicial,
  tcSugerido,
  cambio,
}: {
  accion: (r: Resultado, fd: FormData) => Promise<Resultado>;
  participes: Participe[];
  contactos: Contacto[];
  marcas: string[];
  inicial?: InicialVehiculo;
  tcSugerido?: number | null;
  cambio?: DatosCambioFinancia;
}) {
  const [r, enviar] = useActionState(accion, INICIAL);
  const esNuevo = !inicial;
  const [tipo, setTipo] = useState(inicial?.tipoIngreso ?? "COMPRA");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(inicial?.monedaCompra ?? "USD");
  const [valor, setValor] = useState(
    textoMoneda(inicial ? (inicial.monedaCompra === "USD" ? inicial.valorCompraUsd : inicial.valorCompraArs) : null),
  );
  const [tc, setTc] = useState(textoMoneda(inicial ? inicial.tcIngreso : tcSugerido));
  const [pagoModo, setPagoModo] = useState("PAGADO");
  const [prendado, setPrendado] = useState(inicial?.prendado ?? false);
  const salon = participes.find((p) => p.tipo === "SALON");
  const [financistaId, setFinancistaId] = useState(
    String(inicial?.participeId ?? participes.find((p) => p.tipo === "INVERSOR")?.id ?? salon?.id ?? ""),
  );
  // K9: si el auto lo financia un inversor, la compra la paga él y no pasa por la caja del salón.
  const financiaInversor = tipo !== "CONSIGNACION" && participes.find((x) => String(x.id) === financistaId)?.tipo === "INVERSOR";

  // K15: cambiar quién financia un auto que ya está cargado mueve la caja, salvo que sea una corrección.
  const [cambioModo, setCambioModo] = useState<"PASE" | "CORRECCION">("PASE");
  const anterior = inicial ? participes.find((p) => p.id === inicial.participeId) : undefined;
  const nuevo = participes.find((p) => String(p.id) === financistaId);
  const cambiaFinancista =
    !!inicial && !!cambio && !!anterior && !!nuevo && anterior.id !== nuevo.id && tipo !== "CONSIGNACION" && inicial.tipoIngreso !== "CONSIGNACION";
  const efecto =
    cambiaFinancista && cambio
      ? efectoCambioFinancista({ de: anterior.tipo, a: nuevo.tipo, puesto: cambio.puesto, permutaPendiente: cambio.permutaPendiente, correccion: false })
      : null;
  const [cambioMedio, setCambioMedio] = useState<"EFECTIVO" | "BANCO">("EFECTIVO");
  const textoCambio = cambiaFinancista ? explicarCambio() : null;

  function explicarCambio() {
    if (!cambio || !anterior || !nuevo) return null;
    if (!cambio.enStock) return <p>El auto ya no está en stock: el reparto de su venta quedó cerrado y no se puede cambiar quién lo financia.</p>;
    if (cambioModo === "CORRECCION") {
      return (
        <p>
          <b>No se mueve la caja.</b> Solo se corrige a nombre de quién está el auto: pasa de {anterior.nombre} a {nuevo.nombre} como si siempre hubiera sido así.
        </p>
      );
    }
    if (cambio.permutaPendiente) {
      return <p>La venta que trajo esta permuta sigue abierta: se resuelve sola al cerrarla (K12). No se mueve la caja.</p>;
    }
    if (!efecto) {
      return anterior.tipo === "INVERSOR" && nuevo.tipo === "INVERSOR" ? (
        <p>
          {nuevo.nombre} le paga a {anterior.nombre} directo: <b>la caja del salón no se mueve</b>.
        </p>
      ) : (
        <p>No hay plata puesta en el auto: no se mueve la caja.</p>
      );
    }
    const medio = cambioMedio === "EFECTIVO" ? "efectivo" : "banco";
    return efecto.sentido === "INGRESO" ? (
      <>
        <p>
          {nuevo.nombre} le devuelve al salón lo que había pagado: <b>entran {pesos(efecto.importe)} al {medio}</b>. El auto pasa a ser capital de {nuevo.nombre} y se le
          devuelve al venderlo.
        </p>
        {cambio.saldoCompra > 0 && (
          <p>
            Lo que el salón todavía le debía al vendedor ({pesos(cambio.saldoCompra)}) ahora lo paga {nuevo.nombre} directo: esa cuenta a pagar se cierra.
          </p>
        )}
      </>
    ) : (
      <p>
        El salón le devuelve a {anterior.nombre} lo que había puesto: <b>salen {pesos(efecto.importe)} del {medio}</b>. Si no alcanza, no se guarda (K13).
      </p>
    );
  }

  const nValor = interpretarImporte(valor) ?? 0;
  const nTc = interpretarImporte(tc) ?? 0;
  const conversion = nValor > 0 && nTc > 0 ? compraEnPesos(nValor, moneda, nTc) : null;
  const etiquetaValor = tipo === "CONSIGNACION" ? "Monto pactado con el dueño" : tipo === "PERMUTA" ? "Valor de toma" : "Valor de compra";

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <datalist id="marcas">
        {[...new Set([...marcas, ...MARCAS_SUGERIDAS])].map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <section className="tarjeta flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Cómo ingresa</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="campo">
            Tipo de ingreso
            <select name="tipoIngreso" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              <option value="COMPRA">Compra</option>
              <option value="PERMUTA">Permuta (parte de pago)</option>
              <option value="CONSIGNACION">Consignación (no se compra)</option>
            </select>
          </label>
          <label className="campo">
            Quién financia
            {tipo === "CONSIGNACION" ? (
              <>
                <input value={salon?.nombre ?? "Salón"} disabled />
                <input type="hidden" name="participeId" value={salon?.id ?? ""} />
              </>
            ) : (
              <select name="participeId" value={financistaId} onChange={(e) => setFinancistaId(e.target.value)}>
                {participes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.tipo === "SALON" ? " (fondos propios)" : ""}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="campo">
            {tipo === "CONSIGNACION" ? "Dueño del auto" : "Le compramos a"}
            <select name="contactoOrigenId" defaultValue={inicial?.contactoOrigenId ?? ""}>
              <option value="">—</option>
              {contactos.map((c) => (
                <option key={c.id} value={c.id}>
                  {nombreContacto(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Lo ingresó
            <input name="ingresadoPor" defaultValue={inicial?.ingresadoPor ?? ""} placeholder="Quién trajo el negocio" />
          </label>
        </div>
      </section>

      <section className="tarjeta flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Datos del auto</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="campo">
            Patente
            <input name="dominio" defaultValue={inicial?.dominio ?? ""} placeholder="AB123CD" autoCapitalize="characters" />
          </label>
          <label className="campo">
            Marca *
            <input name="marca" list="marcas" defaultValue={inicial?.marca ?? ""} required />
          </label>
          <label className="campo">
            Modelo *
            <input name="modelo" defaultValue={inicial?.modelo ?? ""} placeholder="Amarok" required />
          </label>
          <label className="campo">
            Versión
            <input name="version" defaultValue={inicial?.version ?? ""} placeholder="Highline 4x4 AT" />
          </label>
          <label className="campo">
            Año *
            <input name="anio" inputMode="numeric" defaultValue={inicial?.anio ?? ""} required />
          </label>
          <label className="campo">
            Kilómetros
            <InputMoneda name="km" defaultValue={inicial?.km} />
          </label>
          <label className="campo">
            Color
            <input name="color" defaultValue={inicial?.color ?? ""} />
          </label>
          <label className="campo">
            Ubicación
            <select name="ubicacion" defaultValue={inicial?.ubicacion ?? "SALON"}>
              {(Object.keys(ETIQUETA_UBICACION) as Ubicacion[]).map((u) => (
                <option key={u} value={u}>
                  {ETIQUETA_UBICACION[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Combustible
            <select name="combustible" defaultValue={inicial?.combustible ?? ""}>
              <option value="">—</option>
              <option>Nafta</option>
              <option>Diésel</option>
              <option>GNC</option>
              <option>Híbrido</option>
              <option>Eléctrico</option>
            </select>
          </label>
          <label className="campo">
            Transmisión
            <select name="transmision" defaultValue={inicial?.transmision ?? ""}>
              <option value="">—</option>
              <option>Manual</option>
              <option>Automática</option>
            </select>
          </label>
          <label className="campo sm:col-span-2">
            Chasis
            <input name="chasis" defaultValue={inicial?.chasis ?? ""} />
          </label>
        </div>
      </section>

      <section className="tarjeta flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Valores</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="campo">
            Fecha de ingreso
            <input type="date" name="fechaIngreso" defaultValue={inicial?.fechaIngreso ?? hoyIso()} />
          </label>
          <label className="campo">
            Moneda
            <span className="flex items-center gap-2">
              <Bandera moneda={moneda} />
              <select name="monedaCompra" value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </span>
          </label>
          <label className="campo">
            {etiquetaValor} *
            <InputMoneda name="valorCompra" value={valor} onChange={setValor} required />
          </label>
          <label className="campo">
            Dólar blue fijado *
            <InputMoneda name="tcIngreso" value={tc} onChange={setTc} required />
          </label>
        </div>
        {conversion && (
          <p className="text-sm text-suave">
            Equivale a <b className="num text-tinta">{pesos(conversion.ars)}</b> ({usd(conversion.usd)}). Precio sugerido sin gastos:{" "}
            <b className="num text-tinta">{pesos(precioSugerido(conversion.ars))}</b>.
          </p>
        )}

        {esNuevo && tipo === "COMPRA" && financiaInversor && (
          <p className="border-t border-linea pt-4 text-sm text-suave">
            La compra la paga el inversor directo al vendedor: <b>no sale de la caja del salón</b> ni queda como deuda. Cuando el auto se venda se le devuelve lo
            que puso, más su parte de la ganancia. Los gastos del auto (chapa, alistaje) sí los pone el salón y los recupera al vender.
          </p>
        )}
        {esNuevo && tipo === "COMPRA" && !financiaInversor && (
          <div className="grid gap-4 border-t border-linea pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="campo">
              Pago al vendedor
              <select name="pagoModo" value={pagoModo} onChange={(e) => setPagoModo(e.target.value)}>
                <option value="PAGADO">Pagado ahora (sale de caja)</option>
                <option value="A_PAGAR">Queda a pagar</option>
                <option value="SIN_REGISTRO">Ya estaba pagado (no mover caja)</option>
              </select>
            </label>
            {pagoModo === "PAGADO" && (
              <label className="campo">
                Medio
                <select name="pagoMedio" defaultValue="EFECTIVO">
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="BANCO">Banco</option>
                </select>
              </label>
            )}
            {pagoModo === "A_PAGAR" && (
              <label className="campo">
                Vence
                <input type="date" name="pagoVencimiento" />
              </label>
            )}
          </div>
        )}
        {tipo === "CONSIGNACION" && (
          <p className="text-sm text-suave">En consignación no se mueve la caja al ingresar: cuando se vende, queda a pagar al dueño el monto pactado.</p>
        )}
        {tipo === "PERMUTA" && esNuevo && (
          <p className="text-sm text-suave">Las permutas normalmente se cargan desde la venta. Usá esta opción solo para registrar permutas anteriores.</p>
        )}
      </section>

      <section className="tarjeta flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <label className="flex min-h-11 items-center gap-2.5 font-semibold">
            <input type="checkbox" name="prendado" checked={prendado} onChange={(e) => setPrendado(e.target.checked)} className="size-5" />
            Auto prendado
          </label>
          {prendado && (
            <>
              <label className="campo">
                Detalle de la prenda
                <input name="prendaDetalle" defaultValue={inicial?.prendaDetalle ?? ""} placeholder="Acreedor, saldo, quién la cancela…" />
              </label>
              <p className="text-sm text-aviso-texto">Para habilitarlo a la venta se va a pedir el papel &quot;Cancelación de prenda&quot;.</p>
            </>
          )}
        </div>
        <label className="campo">
          Observaciones
          <textarea name="observaciones" rows={3} defaultValue={inicial?.observaciones ?? ""} />
        </label>
      </section>

      {cambiaFinancista && anterior && nuevo && (
        <section className="tarjeta flex flex-col gap-4 border-aviso-texto">
          <h2 className="text-lg font-semibold">
            Cambia quién financia: {anterior.nombre} → {nuevo.nombre}
          </h2>
          {cambio?.enStock && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="campo">
                ¿Qué pasó?
                <select name="cambioModo" value={cambioModo} onChange={(e) => setCambioModo(e.target.value as "PASE" | "CORRECCION")}>
                  <option value="PASE">El auto cambia de dueño (se devuelve la plata)</option>
                  <option value="CORRECCION">Fue un error de carga (no mover la caja)</option>
                </select>
              </label>
              {cambioModo === "PASE" && efecto && !cambio.permutaPendiente && (
                <label className="campo">
                  {efecto.sentido === "INGRESO" ? "Entra por" : "Sale por"}
                  <select name="cambioMedio" value={cambioMedio} onChange={(e) => setCambioMedio(e.target.value as "EFECTIVO" | "BANCO")}>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="BANCO">Banco</option>
                  </select>
                </label>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2 text-sm text-suave">{textoCambio}</div>
        </section>
      )}

      <Mensaje r={r} />
      <div className="flex justify-end">
        {cambiaFinancista && anterior && nuevo ? (
          <BotonConfirmar titulo={`¿Pasar el auto de ${anterior.nombre} a ${nuevo.nombre}?`} detalle={textoCambio} confirmar="Guardar cambios" peligro={efecto?.sentido === "EGRESO" && cambioModo === "PASE"}>
            Guardar cambios
          </BotonConfirmar>
        ) : (
          <BotonEnviar>{esNuevo ? "Ingresar auto" : "Guardar cambios"}</BotonEnviar>
        )}
      </div>
    </form>
  );
}
