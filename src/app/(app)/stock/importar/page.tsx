import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { datosFormulario, tcHoy } from "@/server/vehiculos";
import { Importador } from "./importador";

export const metadata = { title: "Importar stock · Colombia Automotores" };

export default async function ImportarPage() {
  await requerirUsuario();
  const [{ participes }, tc] = await Promise.all([datosFormulario(), tcHoy()]);
  return (
    <div className="flex flex-col gap-5">
      <Link href="/stock" className="text-sm font-semibold">
        ← Volver al stock
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Importar stock desde la planilla</h1>
        <p className="mt-1 max-w-3xl text-suave">
          Se lee la hoja &quot;GENERAL&quot;. Columnas reconocidas: DESCRIPCION, MODELO (año), KMS, COLOR, PRECIO VENTA y, si están, PATENTE, COSTO, MONEDA, TC,
          INVERSOR, LO INGRESO, ESTADO y UBICACION. Antes de importar podés revisar y corregir cada fila.
        </p>
      </div>
      <Importador participes={participes.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo }))} tcHoy={tc?.valor ?? null} />
    </div>
  );
}
