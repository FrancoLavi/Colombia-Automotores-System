import Link from "next/link";
import { linkDeRecuperacion } from "@/server/seguridad";
import { FormRestablecer } from "../form";
import { MarcoAcceso } from "../marco";

export const metadata = { title: "Contraseña nueva · Colombia Automotores" };
export const dynamic = "force-dynamic";

export default async function RestablecerPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const link = await linkDeRecuperacion(token);
  if (!link)
    return (
      <MarcoAcceso titulo="El link ya no sirve" bajada="Venció (duran 30 minutos) o ya se usó.">
        <div className="flex flex-col gap-3">
          <Link href="/login/recuperar" className="btn-primario">
            Pedir un link nuevo
          </Link>
          <Link href="/login" className="btn-secundario">
            Volver a ingresar
          </Link>
        </div>
      </MarcoAcceso>
    );
  return (
    <MarcoAcceso titulo="Contraseña nueva" bajada={`Hola ${link.nombre}, elegí tu contraseña nueva.`}>
      <FormRestablecer token={token} />
    </MarcoAcceso>
  );
}
