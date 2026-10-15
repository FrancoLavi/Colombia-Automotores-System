"use client";

import { useActionState, useState } from "react";
import { INICIAL, type Resultado } from "@/lib/form";
import { BotonEnviar, Mensaje } from "@/components/ui";
import { compraEnPesos, precioSugerido } from "@/domain/negocio";
import { interpretarImporte } from "@/domain/importar";
import { pesos, usd, hoyIso } from "@/lib/formato";
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
}

const MARCAS_SUGERIDAS = ["Volkswagen", "Ford", "Renault", "Peugeot", "Fiat", "Chevrolet", "Toyota", "Citroën", "Honda", "Nissan", "Chery", "Jeep"];

export function VehiculoForm({
  accion,
  participes,
  contactos,
  marcas,
  inicial,
  tcSugerido,
}: {
  accion: (r: Resultado, fd: FormData) => Promise<Resultado>;
  participes: Participe[];
  contactos: Contacto[];
  marcas: string[];
  inicial?: InicialVehiculo;
  tcSugerido?: number | null;
}) {
  const [r, enviar] = useActionState(accion, INICIAL);
  const esNuevo = !inicial;
  const [tipo, setTipo] = useState(inicial?.tipoIngreso ?? "COMPRA");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(inicial?.monedaCompra ?? "USD");
  const [valor, setValor] = useState(
    inicial ? String(inicial.monedaCompra === "USD" ? (inicial.valorCompraUsd ?? "") : inicial.valorCompraArs) : "",
  );
  const [tc, setTc] = useState(inicial ? String(inicial.tcIngreso) : tcSugerido ? String(tcSugerido) : "");
  const [pagoModo, setPagoModo] = useState("PAGADO");
  const salon = participes.find((p) => p.tipo === "SALON");

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
              <select name="participeId" defaultValue={inicial?.participeId ?? participes.find((p) => p.tipo === "INVERSOR")?.id ?? salon?.id}>
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
                  {c.nombre} {c.apellido ?? ""}
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
            <input name="km" inputMode="numeric" defaultValue={inicial?.km ?? ""} />
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
            <select name="monedaCompra" value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")}>
              <option value="USD">Dólares</option>
              <option value="ARS">Pesos</option>
            </select>
          </label>
          <label className="campo">
            {etiquetaValor} *
            <input name="valorCompra" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </label>
          <label className="campo">
            Dólar blue fijado *
            <input name="tcIngreso" inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} required />
          </label>
        </div>
        {conversion && (
          <p className="text-sm text-suave">
            Equivale a <b className="num text-tinta">{pesos(conversion.ars)}</b> ({usd(conversion.usd)}). Precio sugerido sin gastos:{" "}
            <b className="num text-tinta">{pesos(precioSugerido(conversion.ars))}</b>.
          </p>
        )}

        {esNuevo && tipo === "COMPRA" && (
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

      <section className="tarjeta">
        <label className="campo">
          Observaciones
          <textarea name="observaciones" rows={3} defaultValue={inicial?.observaciones ?? ""} />
        </label>
      </section>

      <Mensaje r={r} />
      <div className="flex justify-end">
        <BotonEnviar>{esNuevo ? "Ingresar auto" : "Guardar cambios"}</BotonEnviar>
      </div>
    </form>
  );
}
