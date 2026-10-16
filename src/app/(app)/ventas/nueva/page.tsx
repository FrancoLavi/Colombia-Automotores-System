import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { datosNuevaVenta } from "@/server/ventas";
import { FormNuevaVenta } from "./form";

export const metadata = { title: "Nueva venta · Colombia Automotores" };

export default async function NuevaVentaPage({ searchParams }: { searchParams: Promise<{ contacto?: string; vehiculo?: string }> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const { contactos, vehiculos } = await datosNuevaVenta();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/ventas" className="text-sm font-semibold">
        ← Volver a ventas
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Nueva venta</h1>
        <p className="mt-1 text-suave">Se arma como preventa. La seña, la permuta y las formas de pago se cargan en el paso siguiente.</p>
      </div>
      {vehiculos.length === 0 ? (
        <p className="tarjeta text-suave">
          No hay autos disponibles. Un auto queda disponible cuando tiene los papeles y el peritaje: <Link href="/stock">ir al stock</Link>.
        </p>
      ) : (
        <FormNuevaVenta
          contactos={contactos}
          vehiculos={vehiculos}
          contactoInicial={sp.contacto ? Number(sp.contacto) : undefined}
          vehiculoInicial={sp.vehiculo ? Number(sp.vehiculo) : undefined}
        />
      )}
    </div>
  );
}
