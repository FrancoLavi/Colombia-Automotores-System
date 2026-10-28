import Link from "next/link";
import { IlustracionVacio } from "@/components/ilustraciones";

export default function NoEncontrado() {
  return (
    <div className="tarjeta mx-auto flex max-w-lg flex-col items-center gap-3 py-10 text-center">
      <IlustracionVacio className="h-24 w-auto" />
      <h1 className="text-xl font-bold">No encontramos eso</h1>
      <p className="text-sm text-suave">El auto, contacto o venta que buscás no existe o el enlace está mal. Probá buscarlo con Ctrl K.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/stock" className="btn-secundario">
          Ir al stock
        </Link>
        <Link href="/ventas" className="btn-secundario">
          Ir a ventas
        </Link>
        <Link href="/" className="btn-primario">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
