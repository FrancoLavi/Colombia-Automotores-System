"use client";

import Link from "next/link";
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
  const [r, enviar] = useActionState(crearVentaAccion, INICIAL);
  const [filtro, setFiltro] = useState("");
  const [contactoId, setContactoId] = useState(contactoInicial ? String(contactoInicial) : "");
  const [vehiculoId, setVehiculoId] = useState(vehiculoInicial ? String(vehiculoInicial) : "");
  const auto = vehiculos.find((v) => String(v.id) === vehiculoId);
  const [precio, setPrecio] = useState(auto ? String(auto.precio) : "");

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const digitos = q.replace(/\D/g, "");
    return contactos.filter(
      (c) =>
        String(c.id) === contactoId ||
        !q ||
        `${c.nombre} ${c.apellido ?? ""}`.toLowerCase().includes(q) ||
        (digitos.length >= 3 && (c.telefono ?? "").replace(/\D/g, "").includes(digitos)),
    );
  }, [contactos, filtro, contactoId]);

  return (
    <form action={enviar} className="tarjeta flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
        <label className="campo">
          Buscar cliente
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre o teléfono" />
        </label>
        <label className="campo">
          Cliente *
          <select name="contactoId" value={contactoId} onChange={(e) => setContactoId(e.target.value)} required>
            <option value="">Elegí…</option>
            {visibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.apellido ?? ""} {c.telefono ? `· ${c.telefono}` : ""} ({ETIQUETA_ETAPA[c.etapa].toLowerCase()})
              </option>
            ))}
          </select>
        </label>
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
            if (v) setPrecio(String(v.precio));
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
          <input name="precioVenta" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
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
