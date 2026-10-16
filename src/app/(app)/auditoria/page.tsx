import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { datosConfiguracion, historialGlobal } from "@/server/configuracion";

export const metadata = { title: "Historial de cambios · Colombia Automotores" };

const ENTIDADES: Record<string, { texto: string; ruta: (id: number) => string | null }> = {
  vehiculo: { texto: "Auto", ruta: (id) => `/stock/${id}` },
  contacto: { texto: "Contacto", ruta: (id) => `/contactos/${id}` },
  operacion: { texto: "Venta", ruta: (id) => `/ventas/${id}` },
  caja: { texto: "Caja", ruta: () => "/caja" },
  configuracion: { texto: "Configuración", ruta: () => "/configuracion" },
};

type Busqueda = { usuario?: string; entidad?: string; desde?: string; hasta?: string; q?: string };

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const [filas, { usuarios }] = await Promise.all([
    historialGlobal({ usuarioId: sp.usuario ? Number(sp.usuario) : undefined, entidad: sp.entidad, desde: sp.desde, hasta: sp.hasta, q: sp.q }),
    datosConfiguracion(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-bold">Historial de cambios</h1>
        <p className="mt-1 text-suave">Quién hizo qué y cuándo: altas, modificaciones, cambios de estado y anulaciones.</p>
      </header>
      <form method="get" className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="campo">
          Usuario
          <select name="usuario" defaultValue={sp.usuario ?? ""}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Sobre
          <select name="entidad" defaultValue={sp.entidad ?? ""}>
            <option value="">Todo</option>
            {Object.entries(ENTIDADES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.texto}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Desde
          <input type="date" name="desde" defaultValue={sp.desde} />
        </label>
        <label className="campo">
          Hasta
          <input type="date" name="hasta" defaultValue={sp.hasta} />
        </label>
        <label className="campo">
          Buscar
          <input type="search" name="q" defaultValue={sp.q} placeholder="Texto del cambio" />
        </label>
        <button className="btn-secundario self-end">Filtrar</button>
      </form>
      <section className="tarjeta overflow-x-auto p-0">
        {filas.length === 0 ? (
          <p className="p-6 text-suave">No hay cambios con estos filtros.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Sobre</th>
                <th>Qué pasó</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ a, usuario }) => {
                const e = ENTIDADES[a.entidad];
                const ruta = e?.ruta(a.entidadId);
                const cambios = a.cambios ? Object.entries(a.cambios).filter(([k]) => !["id", "creadoEn"].includes(k)) : [];
                return (
                  <tr key={a.id}>
                    <td className="num">{a.fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td>{usuario ?? "Sistema"}</td>
                    <td>{ruta ? <Link href={ruta}>{e.texto}</Link> : (e?.texto ?? a.entidad)}</td>
                    <td className="max-w-xl whitespace-normal">
                      {a.descripcion ?? a.accion.toLowerCase()}
                      {a.accion === "MODIFICAR" && cambios.length > 0 && cambios.length <= 6 && (
                        <details className="text-xs text-apagado">
                          <summary className="cursor-pointer">Ver campos</summary>
                          {cambios.map(([k, [antes, despues]]) => (
                            <div key={k}>
                              {k}: <s>{String(antes ?? "—")}</s> → {String(despues ?? "—")}
                            </div>
                          ))}
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
