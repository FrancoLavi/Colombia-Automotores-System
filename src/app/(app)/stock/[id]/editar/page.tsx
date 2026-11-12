import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { datosFormulario, fichaVehiculo, marcasUsadas } from "@/server/vehiculos";
import { saldosActuales } from "@/server/caja";
import { VehiculoForm } from "../../vehiculo-form";
import { editarVehiculoAccion } from "../../actions";

export default async function EditarVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const id = Number((await params).id);
  const ficha = await fichaVehiculo(id);
  if (!ficha) notFound();
  const [{ participes, contactos }, marcas, saldos] = await Promise.all([datosFormulario(), marcasUsadas(), saldosActuales()]);
  const v = ficha.v;
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <Link href={`/stock/${id}`} className="text-sm font-semibold">
        ← Volver a la ficha
      </Link>
      <h1 className="text-3xl font-bold">
        Editar {v.marca} {v.modelo} {v.dominio ?? ""}
      </h1>
      <VehiculoForm
        accion={editarVehiculoAccion.bind(null, id)}
        participes={participes}
        contactos={contactos}
        marcas={marcas}
        inicial={{ ...v, valorCompraUsd: v.valorCompraUsd ?? null }}
        cambio={
          ficha.puesto
            ? {
                puesto: ficha.puesto.puesto,
                permutaPendiente: ficha.puesto.permutaPendiente,
                saldoCompra: ficha.puesto.saldoCompra,
                enStock: ["POR_INGRESAR", "DISPONIBLE", "RESERVADO"].includes(v.estado),
                saldos,
              }
            : undefined
        }
      />
    </div>
  );
}
