import { requerirUsuario } from "@/lib/auth";
import { vistaMoneda } from "@/lib/moneda";
import { tcHoy } from "@/server/vehiculos";
import { salir } from "../login/actions";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requerirUsuario();
  const [vista, tc] = await Promise.all([vistaMoneda(), tcHoy()]);
  return (
    <div className="min-h-screen md:flex">
      <Nav nombre={u.nombre} salir={salir} enDolares={vista.enDolares} hayDolar={!!tc} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        {vista.enDolares && (
          <p role="status" className="mb-5 rounded-lg border border-[#8fa9f0] bg-info-fondo px-4 py-2.5 text-sm text-info-texto">
            Estás viendo los importes <b>en dólares</b>, convertidos al blue de hoy (<span className="num">$ {vista.tc?.toLocaleString("es-AR")}</span>
            {vista.fuente === "API" ? ", dolarapi.com" : ", cargado a mano"}). Los formularios se siguen cargando en pesos y el dólar fijado en cada compra no cambia.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
