import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { datosFormulario, marcasUsadas, tcHoy } from "@/server/vehiculos";
import { VehiculoForm } from "../vehiculo-form";
import { crearVehiculoAccion } from "../actions";

export const metadata = { title: "Ingresar auto · Colombia Automotores" };

export default async function NuevoVehiculoPage() {
  await requerirUsuario();
  const [{ participes, contactos }, marcas, tc] = await Promise.all([datosFormulario(), marcasUsadas(), tcHoy()]);
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <Link href="/stock" className="text-sm font-semibold">
        ← Volver al stock
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Ingresar auto</h1>
        <p className="mt-1 text-suave">Queda &quot;por ingresar&quot; hasta tener los papeles y el peritaje.</p>
      </div>
      <VehiculoForm accion={crearVehiculoAccion} participes={participes} contactos={contactos} marcas={marcas} tcSugerido={tc?.valor} />
    </div>
  );
}
