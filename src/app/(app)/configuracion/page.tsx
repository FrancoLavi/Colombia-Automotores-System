import { requerirUsuario } from "@/lib/auth";
import { datosConfiguracion } from "@/server/configuracion";
import { obtenerParametros, obtenerDatosSalon } from "@/server/parametros";
import { nombreMes, periodoDe } from "@/domain/dashboard";
import {
  AccionesUsuario,
  FilaCategoria,
  FilaDocumento,
  FilaParticipe,
  FilaPersona,
  FormCategoria,
  FormDocumento,
  FormInversor,
  FormMiPassword,
  FormObjetivo,
  FormParametros,
  FormSalon,
  FormPersona,
  FormUsuario,
} from "./formularios";

export const metadata = { title: "Configuración · Colombia Automotores" };

export default async function ConfiguracionPage() {
  const u = await requerirUsuario();
  const [d, p, salon] = await Promise.all([datosConfiguracion(), obtenerParametros(), obtenerDatosSalon()]);
  const hoy = new Date();
  const periodos = [0, 1, 2].map((i) => {
    const v = periodoDe(new Date(hoy.getFullYear(), hoy.getMonth() + i, 1));
    return { valor: v, texto: nombreMes(v) };
  });
  const actuales = Object.fromEntries(d.objetivos.map((o) => [o.periodo, { unidades: o.unidades, ganancia: o.ganancia }]));
  const inversores = d.participes.filter((x) => x.tipo === "INVERSOR" && x.activo);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="mt-1 text-suave">Objetivos, reglas del negocio, inversores, usuarios y listas.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Objetivos del mes</h2>
          <FormObjetivo periodos={periodos} actuales={actuales} />
        </section>
        <section className="tarjeta flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Mi cuenta</h2>
          <p className="text-sm text-suave">
            {u.nombre} · {u.email}
          </p>
          <FormMiPassword />
        </section>
      </div>

      <section className="tarjeta flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Reglas del negocio</h2>
        <FormParametros key={JSON.stringify(p)} p={p} />
      </section>

      <section className="tarjeta flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Datos del salón</h2>
          <p className="text-sm text-apagado">Encabezan la preventa en PDF que se le da al cliente.</p>
        </div>
        <FormSalon key={JSON.stringify(salon)} d={salon} />
      </section>

      <section className="tarjeta flex flex-col">
        <h2 className="pb-1 text-lg font-semibold">Personas (socios y empleados)</h2>
        <p className="pb-2 text-sm text-apagado">A quién se atribuyen los sueldos y retiros que se cargan en Caja. No necesitan usuario en el sistema.</p>
        {d.personas.map((x) => (
          <FilaPersona key={JSON.stringify(x)} p={x} />
        ))}
        <FormPersona />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta flex flex-col">
          <h2 className="pb-1 text-lg font-semibold">Inversores</h2>
          <p className="pb-2 text-sm text-apagado">Quién financia cada auto. El salón representa los fondos propios.</p>
          {d.participes.map((x) => (
            <FilaParticipe key={JSON.stringify(x)} p={x} />
          ))}
          <div className="border-t border-linea pt-3">
            <FormInversor />
          </div>
        </section>

        <section className="tarjeta flex flex-col">
          <h2 className="pb-1 text-lg font-semibold">Usuarios</h2>
          <p className="pb-2 text-sm text-apagado">Los socios y el empleado tienen acceso total. Un inversor solo ve sus autos y sus ganancias.</p>
          {d.usuarios.map((x) => (
            <div key={x.id} className={`flex flex-wrap items-center justify-between gap-2 border-t border-linea py-2.5 text-sm ${x.activo ? "" : "opacity-60"}`}>
              <span>
                <b>{x.nombre}</b> <span className="text-apagado">· {x.email}</span>
                <span className="block text-xs text-apagado">
                  {x.rol === "ADMIN" ? "Acceso total" : `Inversor: ${d.participes.find((p) => p.id === x.participeId)?.nombre ?? "—"}`}
                  {!x.activo && " · desactivado"}
                </span>
              </span>
              <AccionesUsuario id={x.id} activo={x.activo} esYo={x.id === u.id} />
            </div>
          ))}
          <details className="border-t border-linea pt-3">
            <summary className="btn-secundario cursor-pointer list-none">+ Nuevo usuario</summary>
            <div className="mt-3">
              <FormUsuario inversores={inversores} />
            </div>
          </details>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta flex flex-col">
          <h2 className="pb-1 text-lg font-semibold">Papeles del auto</h2>
          <p className="pb-2 text-sm text-apagado">Los obligatorios tienen que estar para dejar un auto disponible. Los cambios aplican a los autos que ingresen desde ahora.</p>
          {d.documentos.map((x) => (
            <FilaDocumento key={JSON.stringify(x)} d={x} />
          ))}
          <FormDocumento />
        </section>
        <section className="tarjeta flex flex-col">
          <h2 className="pb-1 text-lg font-semibold">Categorías de gasto</h2>
          {d.categorias.map((x) => (
            <FilaCategoria key={JSON.stringify(x)} c={x} />
          ))}
          <FormCategoria />
        </section>
      </div>
    </div>
  );
}
