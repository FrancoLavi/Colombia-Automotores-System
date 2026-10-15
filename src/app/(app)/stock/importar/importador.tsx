"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FilaImportacion } from "@/server/importar-stock";
import type { Resultado } from "@/lib/form";
import { Mensaje } from "@/components/ui";
import { hoyIso, pesos } from "@/lib/formato";
import { interpretarImporte } from "@/domain/importar";
import { importarAccion, leerPlanillaAccion } from "../actions";

type Participe = { id: number; nombre: string; tipo: "SALON" | "INVERSOR" };

export function Importador({ participes, tcHoy }: { participes: Participe[]; tcHoy: number | null }) {
  const router = useRouter();
  const [filas, setFilas] = useState<FilaImportacion[] | null>(null);
  const [hoja, setHoja] = useState("");
  const [r, setR] = useState<Resultado>({ ok: false });
  const [pendiente, iniciar] = useTransition();
  const [tc, setTc] = useState(tcHoy ? String(tcHoy) : "");
  const [participeId, setParticipeId] = useState(String(participes.find((p) => p.tipo === "INVERSOR")?.id ?? participes[0]?.id ?? ""));
  const [fechaIngreso, setFechaIngreso] = useState(hoyIso());
  const [papeles, setPapeles] = useState(true);

  const cambiar = (i: number, cambio: Partial<FilaImportacion>) => setFilas((fs) => fs!.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  const elegidas = filas?.filter((f) => f.incluir && f.estado !== "VENDIDA").length ?? 0;

  if (!filas) {
    return (
      <form
        className="tarjeta flex max-w-xl flex-col gap-3"
        action={(fd) =>
          iniciar(async () => {
            const res = await leerPlanillaAccion(fd);
            if (res.ok) {
              setFilas(res.filas);
              setHoja(res.hoja);
              setR({ ok: false });
            } else setR({ ok: false, error: res.error });
          })
        }
      >
        <label className="campo">
          Planilla (.xlsx)
          <input type="file" name="archivo" accept=".xlsx" required className="py-2" />
        </label>
        <Mensaje r={r} />
        <button className="btn-primario self-start" disabled={pendiente}>
          {pendiente ? "Leyendo…" : "Leer planilla"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="tarjeta grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="campo">
          Dólar para filas sin TC *
          <input inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} />
        </label>
        <label className="campo">
          Financista para filas sin inversor
          <select value={participeId} onChange={(e) => setParticipeId(e.target.value)}>
            {participes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Fecha de ingreso
          <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold">
          <input type="checkbox" checked={papeles} onChange={(e) => setPapeles(e.target.checked)} className="h-5 w-5" />
          Marcar papeles como recibidos
        </label>
      </section>

      <p className="text-sm text-suave">
        Hoja &quot;{hoja}&quot;: {filas.length} filas leídas, {elegidas} seleccionadas. Las filas sin costo quedan con una alerta para completarlo después desde la
        ficha.
      </p>

      <section className="tarjeta overflow-x-auto p-0">
        <table className="tabla">
          <thead>
            <tr>
              <th>Importar</th>
              <th>Fila</th>
              <th>Patente</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Versión</th>
              <th>Año</th>
              <th className="text-right">Precio venta</th>
              <th>Costo</th>
              <th>Estado</th>
              <th>Avisos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.fila} className={f.incluir ? "" : "opacity-50"}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Importar fila ${f.fila}`}
                    checked={f.incluir}
                    disabled={f.estado === "VENDIDA"}
                    onChange={(e) => cambiar(i, { incluir: e.target.checked })}
                    className="h-5 w-5"
                  />
                </td>
                <td className="num">{f.fila}</td>
                <td>
                  <input
                    aria-label="Patente"
                    value={f.dominio ?? ""}
                    onChange={(e) => cambiar(i, { dominio: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") || null })}
                    className="min-h-11 w-28 rounded-lg border border-[#c9c5ba] px-2 font-mono"
                  />
                </td>
                <td>
                  <input aria-label="Marca" value={f.marca} onChange={(e) => cambiar(i, { marca: e.target.value })} className="min-h-11 w-32 rounded-lg border border-[#c9c5ba] px-2" />
                </td>
                <td>
                  <input aria-label="Modelo" value={f.modelo} onChange={(e) => cambiar(i, { modelo: e.target.value })} className="min-h-11 w-32 rounded-lg border border-[#c9c5ba] px-2" />
                </td>
                <td className="text-apagado">{f.version}</td>
                <td>{f.anio ?? <span className="text-aviso-texto">falta</span>}</td>
                <td className="num text-right">{pesos(f.precioVenta)}</td>
                <td>
                  <div className="flex gap-1">
                    <input
                      aria-label="Costo"
                      inputMode="decimal"
                      value={f.costo ?? ""}
                      onChange={(e) => {
                        const costo = interpretarImporte(e.target.value);
                        // Igual que al leer la planilla: un monto menor a 200.000 se toma en USD (se puede cambiar al lado).
                        cambiar(i, { costo, moneda: costo != null && costo < 200_000 ? "USD" : "ARS" });
                      }}
                      className="min-h-11 w-28 rounded-lg border border-[#c9c5ba] px-2 font-mono"
                    />
                    <select aria-label="Moneda del costo" value={f.moneda} onChange={(e) => cambiar(i, { moneda: e.target.value as "ARS" | "USD" })} className="min-h-11 rounded-lg border border-[#c9c5ba] px-1">
                      <option value="USD">USD</option>
                      <option value="ARS">$</option>
                    </select>
                  </div>
                </td>
                <td>
                  <select
                    aria-label="Estado"
                    value={f.estado}
                    onChange={(e) => cambiar(i, { estado: e.target.value as FilaImportacion["estado"], incluir: e.target.value !== "VENDIDA" })}
                    className="min-h-11 rounded-lg border border-[#c9c5ba] px-1"
                  >
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="POR_INGRESAR">Por ingresar</option>
                    <option value="VENDIDA">Vendida (no importar)</option>
                  </select>
                </td>
                <td className="whitespace-normal text-xs text-aviso-texto">{f.avisos.filter((a) => !a.startsWith("Sin dólar")).join(" · ")}</td>
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
          disabled={pendiente || !elegidas}
          onClick={() =>
            iniciar(async () => {
              const res = await importarAccion(filas, {
                tcDefecto: interpretarImporte(tc) ?? 0,
                participeDefectoId: Number(participeId),
                fechaIngreso,
                papelesRecibidos: papeles,
              });
              setR(res);
              if (res.ok) router.push("/stock");
            })
          }
        >
          {pendiente ? "Importando…" : `Importar ${elegidas} autos`}
        </button>
      </div>
    </div>
  );
}
