"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FilaContacto } from "@/server/contactos";
import type { Resultado } from "@/lib/form";
import { Mensaje } from "@/components/ui";
import { ETIQUETA_ORIGEN } from "@/domain/contactos";
import { importarContactosAccion, leerContactosAccion } from "../actions";

export default function ImportarContactosPage() {
  const router = useRouter();
  const [filas, setFilas] = useState<(FilaContacto & { incluir: boolean })[] | null>(null);
  const [r, setR] = useState<Resultado>({ ok: false });
  const [pendiente, iniciar] = useTransition();
  const elegidas = filas?.filter((f) => f.incluir) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contactos" className="text-sm font-semibold">
        ← Volver a contactos
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Importar contactos</h1>
        <p className="mt-1 max-w-3xl text-suave">
          Excel (.xlsx) o CSV. Columnas reconocidas: NOMBRE (o NOMBRE Y APELLIDO / CLIENTE), APELLIDO, TELEFONO o CELULAR, MAIL, LOCALIDAD, ORIGEN, INTERES,
          USADO, OBSERVACIONES y DNI. Los teléfonos que ya existen se marcan como duplicados y no se importan.
        </p>
      </div>

      {!filas ? (
        <form
          className="tarjeta flex max-w-xl flex-col gap-3"
          action={(fd) =>
            iniciar(async () => {
              const res = await leerContactosAccion(fd);
              if (res.ok) {
                setFilas(res.filas.map((f) => ({ ...f, incluir: !f.duplicado })));
                setR({ ok: false });
              } else setR({ ok: false, error: res.error });
            })
          }
        >
          <label className="campo">
            Archivo
            <input type="file" name="archivo" accept=".xlsx,.csv" required className="py-2" />
          </label>
          <Mensaje r={r} />
          <button className="btn-primario self-start" disabled={pendiente}>
            {pendiente ? "Leyendo…" : "Leer archivo"}
          </button>
        </form>
      ) : (
        <>
          <p className="text-sm text-suave">
            {filas.length} filas leídas · {filas.filter((f) => f.duplicado).length} duplicadas · {elegidas.length} seleccionadas.
          </p>
          <section className="tarjeta overflow-x-auto p-0">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Importar</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Origen</th>
                  <th>Busca</th>
                  <th>Aviso</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.fila} className={f.incluir ? "" : "opacity-50"}>
                    <td>
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        aria-label={`Importar fila ${f.fila}`}
                        checked={f.incluir}
                        onChange={(e) => setFilas((fs) => fs!.map((x, j) => (j === i ? { ...x, incluir: e.target.checked } : x)))}
                      />
                    </td>
                    <td>
                      {f.nombre} {f.apellido}
                    </td>
                    <td className="num">{f.telefono ?? "—"}</td>
                    <td>{ETIQUETA_ORIGEN[f.origen]}</td>
                    <td className="whitespace-normal">{f.productoInteres ?? "—"}</td>
                    <td className="text-xs text-aviso-texto">{f.duplicado ? `Duplicado: ${f.duplicado}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <Mensaje r={r} />
          <div className="flex flex-wrap justify-end gap-2.5">
            <button type="button" className="btn-secundario" onClick={() => setFilas(null)}>
              Elegir otro archivo
            </button>
            <button
              type="button"
              className="btn-primario"
              disabled={pendiente || !elegidas.length}
              onClick={() =>
                iniciar(async () => {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se quita el campo de la vista previa
                  const res = await importarContactosAccion(elegidas.map(({ incluir, ...f }) => f));
                  setR(res);
                  if (res.ok) setTimeout(() => router.push("/contactos"), 1500);
                })
              }
            >
              {pendiente ? "Importando…" : `Importar ${elegidas.length} contactos`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
