import { redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { subcajas } from "@/server/caja";
import { pesos, usd } from "@/lib/formato";
import { ETIQUETA_ESTADO } from "@/domain/stock";
import { salir } from "../login/actions";
import { FormMiPassword } from "../(app)/configuracion/formularios";

export const metadata = { title: "Mi inversión · Colombia Automotores" };

/** Vista de solo lectura para un usuario inversor (T2): sus autos y sus ganancias. */
export default async function MiInversionPage() {
  const u = await requerirUsuario({ permitirInversor: true });
  if (u.rol !== "INVERSOR") redirect("/");
  const f = (await subcajas()).find((x) => x.participe.id === u.participeId);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-apagado">Colombia Automotores</p>
          <h1 className="text-3xl font-bold">Hola, {u.nombre}</h1>
        </div>
        <form action={salir}>
          <button className="btn-secundario">Cerrar sesión</button>
        </form>
      </header>

      {!f ? (
        <p className="tarjeta text-suave">Tu usuario todavía no está asociado a un inversor. Pedile al salón que lo configure.</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="tarjeta">
              <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Invertido en autos</div>
              <div className="num mt-1 text-2xl">{pesos(f.capital)}</div>
              <div className="num text-xs text-apagado">{usd(f.capitalUsd)} al dólar de compra</div>
            </div>
            <div className="tarjeta">
              <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Ganancia por cobrar</div>
              <div className="num mt-1 text-2xl">{pesos(f.pendiente)}</div>
            </div>
            <div className="tarjeta">
              <div className="text-xs font-semibold uppercase tracking-wider text-apagado">Ganancia cobrada</div>
              <div className="num mt-1 text-2xl text-ok-texto">{pesos(f.cobrado)}</div>
            </div>
          </section>
          <section className="tarjeta flex flex-col">
            <h2 className="pb-2 text-lg font-semibold">Tus autos en stock</h2>
            {f.autos.length === 0 && <p className="text-sm text-apagado">No hay autos tuyos en stock en este momento.</p>}
            {f.autos.map((a) => (
              <div key={a.id} className="flex flex-wrap justify-between gap-2 border-t border-linea py-2 text-sm">
                <span>
                  {a.marca} {a.modelo} {a.anio} <span className="text-apagado">· {ETIQUETA_ESTADO[a.estado].toLowerCase()}</span>
                </span>
                <span className="num">{pesos(a.costo)}</span>
              </div>
            ))}
          </section>
        </>
      )}

      <details className="tarjeta">
        <summary className="cursor-pointer font-semibold">Cambiar mi contraseña</summary>
        <div className="mt-3">
          <FormMiPassword />
        </div>
      </details>
    </main>
  );
}
