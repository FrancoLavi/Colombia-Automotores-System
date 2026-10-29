"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Diálogo de confirmación propio (en lugar del confirm() del navegador): dice qué va a pasar
 * con palabras del negocio y deja el foco en "Cancelar", así un Enter apurado no confirma.
 * Esc o un clic afuera lo cierran sin hacer nada.
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
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const cancelar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      cancelar.current?.focus();
    } else if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      aria-labelledby={idTitulo}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-borde bg-superficie p-0 text-tinta shadow-xl backdrop:bg-black/45"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 id={idTitulo} className="text-lg font-semibold">
          {titulo}
        </h2>
        {children && <div className="flex flex-col gap-2 text-sm text-suave">{children}</div>}
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button ref={cancelar} type="button" className="btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className={peligro ? "btn bg-aviso-texto text-white hover:opacity-90" : "btn-primario"}
            onClick={() => {
              onConfirmar();
              onCerrar();
            }}
          >
            {confirmar}
          </button>
        </div>
      </div>
    </dialog>
  );
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
