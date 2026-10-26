"use client";

import { nombreContacto } from "@/lib/formato";
import Link from "next/link";
import { InputMoneda, textoMoneda } from "@/components/input-moneda";
import { useActionState, useMemo, useState } from "react";
import { INICIAL } from "@/lib/form";
import { BotonEnviar, Mensaje } from "@/components/ui";
import { ETIQUETA_ETAPA, type Etapa } from "@/domain/contactos";
import { crearVentaAccion } from "../actions";

type Contacto = { id: number; nombre: string; apellido: string | null; telefono: string | null; etapa: Etapa };
type Auto = { id: number; etiqueta: string; precio: number };

export function FormNuevaVenta({
  contactos,
  vehiculos,
  contactoInicial,
  vehiculoInicial,
}: {
  contactos: Contacto[];
  vehiculos: Auto[];
  contactoInicial?: number;
  vehiculoInicial?: number;
}) {
  const etiquetaCliente = (c: Contacto) =>
    `${nombreContacto(c)}${c.telefono ? ` · ${c.telefono}` : ""} (${ETIQUETA_ETAPA[c.etapa].toLowerCase()})`;

  const [r, enviar] = useActionState(crearVentaAccion, INICIAL);
  const [contactoId, setContactoId] = useState(contactoInicial ? String(contactoInicial) : "");
  const inicial = contactos.find((c) => String(c.id) === String(contactoInicial ?? ""));
  const [filtro, setFiltro] = useState(inicial ? etiquetaCliente(inicial) : "");
  const [abierto, setAbierto] = useState(false);
  const [vehiculoId, setVehiculoId] = useState(vehiculoInicial ? String(vehiculoInicial) : "");
  const auto = vehiculos.find((v) => String(v.id) === vehiculoId);
  const [precio, setPrecio] = useState(textoMoneda(auto?.precio));

  // Un solo campo: se escribe y se elige de la lista que baja. El id viaja en un campo oculto.
  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const digitos = q.replace(/\D/g, "");
    if (!q) return contactos.slice(0, 8);
    return contactos
      .filter(
        (c) =>
          `${c.nombre} ${c.apellido ?? ""}`.toLowerCase().includes(q) ||
          (digitos.length >= 3 && (c.telefono ?? "").replace(/\D/g, "").includes(digitos)),
      )
      .slice(0, 8);
  }, [contactos, filtro]);

  const elegir = (c: Contacto) => {
    setContactoId(String(c.id));
    setFiltro(etiquetaCliente(c));
    setAbierto(false);
  };

  return (
    <form action={enviar} className="tarjeta flex flex-col gap-4">
      <div className="campo relative">
        <label htmlFor="cliente">Cliente *</label>
        <input
          id="cliente"
          role="combobox"
          aria-expanded={abierto}
          aria-controls="lista-clientes"
          aria-autocomplete="list"
          autoComplete="off"
          required
          value={filtro}
          placeholder="Escribí el nombre o el teléfono"
          onChange={(e) => {
            setFiltro(e.target.value);
            // Si retoca el texto, lo elegido deja de valer: no se manda un id que no se ve.
            setContactoId("");
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAbierto(false);
            if (e.key === "Enter" && abierto && visibles.length) {
              e.preventDefault();
              elegir(visibles[0]);
            }
          }}
        />
        <input type="hidden" name="contactoId" value={contactoId} />
        {abierto && !contactoId && visibles.length > 0 && (
          <ul
            id="lista-clientes"
            role="listbox"
            className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-borde bg-superficie py-1 shadow-lg"
          >
            {visibles.map((c) => (
              <li key={c.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  // Sin esto el blur del input cierra la lista antes de que llegue el click.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(c)}
                  className="block w-full px-3 py-2.5 text-left text-sm font-normal hover:bg-fondo"
                >
                  {etiquetaCliente(c)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {filtro.trim() && !contactoId && visibles.length === 0 && (
          <span className="text-xs font-normal text-aviso-texto">Ningún cliente coincide. Revisá el nombre o cargalo como dato.</span>
        )}
      </div>
      <p className="-mt-2 text-sm text-apagado">
        ¿No está cargado? <Link href="/contactos">Cargalo como dato</Link> y volvé.
      </p>
      <label className="campo">
        Auto (solo disponibles) *
        <select
          name="vehiculoId"
          value={vehiculoId}
          onChange={(e) => {
            setVehiculoId(e.target.value);
            const v = vehiculos.find((x) => String(x.id) === e.target.value);
            if (v) setPrecio(textoMoneda(v.precio));
          }}
          required
        >
          <option value="">Elegí…</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.etiqueta} · $ {v.precio.toLocaleString("es-AR")}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="campo">
          Precio de venta ($) *
          <InputMoneda name="precioVenta" value={precio} onChange={setPrecio} required />
        </label>
        <label className="campo">
          Observaciones
          <input name="observaciones" />
        </label>
      </div>
      <Mensaje r={r} />
      <div className="flex justify-end">
        <BotonEnviar>Crear preventa</BotonEnviar>
      </div>
    </form>
  );
}
