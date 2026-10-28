"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IlustracionVacio } from "@/components/ilustraciones";

/** Si una pantalla falla: lo dice en criollo, no pierde el menú y deja reintentar o volver. */
export default function ErrorPantalla({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="tarjeta mx-auto flex max-w-lg flex-col items-center gap-3 py-10 text-center">
      <IlustracionVacio className="h-24 w-auto" />
      <h1 className="text-xl font-bold">No se pudo mostrar esta pantalla</h1>
      <p className="text-sm text-suave">
        Puede ser un corte de conexión con la base. Lo que estabas cargando y no llegaste a guardar no se guardó; lo que ya estaba guardado sigue igual.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-primario" onClick={reset}>
          Reintentar
        </button>
        <Link href="/" className="btn-secundario">
          Ir al inicio
        </Link>
      </div>
      {error.digest && <p className="text-xs text-apagado">Código para soporte: {error.digest}</p>}
    </div>
  );
}
