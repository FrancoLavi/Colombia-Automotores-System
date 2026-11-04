"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { alerta, CLASES_ALERTA } from "./alertas";

/**
 * Diálogo de confirmación (SweetAlert): dice qué va a pasar con palabras del negocio y deja el
 * foco en "Cancelar", así un Enter apurado no confirma. Esc o un clic afuera lo cierran sin hacer nada.
 */
export function Dialogo({
  abierto,
  titulo,
  children,
  confirmar,
  peligro = false,
  onConfirmar,
  onCerrar,
}: {
  abierto: boolean;
  titulo: string;
  children?: React.ReactNode;
  confirmar: string;
  peligro?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  // Las funciones cambian en cada render: se leen de una ref para no volver a abrir el diálogo.
  const fn = useRef({ onConfirmar, onCerrar });
  fn.current = { onConfirmar, onCerrar };
  const mostrando = useRef(false);
  useEffect(() => {
    if (!abierto || mostrando.current) return;
    mostrando.current = true;
    alerta
      .fire({
        title: titulo,
        html: children ? <div className="flex flex-col gap-2 text-left text-sm text-suave">{children}</div> : undefined,
        icon: peligro ? "warning" : "question",
        showCancelButton: true,
        confirmButtonText: confirmar,
        cancelButtonText: "Cancelar",
        focusCancel: true,
        reverseButtons: true,
        customClass: { ...CLASES_ALERTA, confirmButton: peligro ? "btn bg-aviso-texto text-white hover:opacity-90" : "btn-primario" },
      })
      .then((r) => {
        mostrando.current = false;
        if (r.isConfirmed) fn.current.onConfirmar();
        fn.current.onCerrar();
      });
  }, [abierto, titulo, children, confirmar, peligro]);
  return null;
}

/**
 * Botón de envío que antes pide confirmación. Va dentro del <form> como un BotonEnviar:
 * primero valida los campos del form y, si están bien, muestra el diálogo.
 * Para acciones que no se deshacen: cerrar una venta, darla de baja, pagar, anular.
 */
export function BotonConfirmar({
  children,
  titulo,
  detalle,
  confirmar,
  className = "btn-primario",
  pendiente = "Guardando…",
  peligro = false,
  name,
  value,
}: {
  children: React.ReactNode;
  titulo: string;
  detalle?: React.ReactNode;
  confirmar?: string;
  className?: string;
  pendiente?: string;
  peligro?: boolean;
  /** Como en un <button name value>: viaja en el FormData al confirmar. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const enviar = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={boton}
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (boton.current?.form?.reportValidity() === false) return;
          setAbierto(true);
        }}
      >
        {pending ? pendiente : children}
      </button>
      {/* Deshabilitado para que un Enter en un campo no envíe salteando la confirmación. */}
      <button ref={enviar} type="submit" name={name} value={value} hidden disabled tabIndex={-1} aria-hidden="true" />
      <Dialogo
        abierto={abierto}
        titulo={titulo}
        confirmar={confirmar ?? (typeof children === "string" ? children : "Confirmar")}
        peligro={peligro}
        onConfirmar={() => {
          const b = enviar.current;
          if (!b) return;
          b.disabled = false;
          b.form?.requestSubmit(b);
          b.disabled = true;
        }}
        onCerrar={() => setAbierto(false)}
      >
        {detalle}
      </Dialogo>
    </>
  );
}
