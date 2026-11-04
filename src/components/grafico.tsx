"use client";

import { useState } from "react";

/**
 * Gráfico de barras agrupadas, liviano y sin librerías. Los textos (montos ya formateados, en
 * pesos o en dólares) llegan armados desde el servidor; acá solo se dibuja y se maneja el hover.
 *
 * - Colores por serie en orden fijo (--color-serie-1..3, validados para daltonismo); con 2 o más
 *   series hay leyenda, así el color nunca es lo único que identifica.
 * - Barras finas con 2px de separación, punta redondeada sobre la línea base; grilla tenue.
 * - Al pasar el mouse (o tocar) un grupo se ve el detalle; abajo hay una tabla para lectores de pantalla.
 */
export interface SerieGrafico {
  nombre: string;
  /** 1, 2 o 3: siempre en este orden. */
  color: 1 | 2 | 3;
  valores: number[];
  textos: string[];
}

export function GraficoBarras({
  titulo,
  etiquetas,
  etiquetasLargas,
  series,
  marcas,
  resaltar,
  alto = 190,
}: {
  titulo: string;
  etiquetas: string[];
  /** Para el detalle y la tabla (ej. "Noviembre 2026"); si no, las cortas. */
  etiquetasLargas?: string[];
  series: SerieGrafico[];
  /** Líneas de referencia del eje (valor y texto ya formateado). La primera es el cero. */
  marcas: { valor: number; texto: string }[];
  /** Índice del grupo a resaltar (ej. el mes elegido en el filtro). */
  resaltar?: number;
  alto?: number;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(1, ...marcas.map((x) => x.valor), ...series.flatMap((s) => s.valores));
  const largas = etiquetasLargas ?? etiquetas;
  const sinDatos = series.every((s) => s.valores.every((v) => !v));
  const pct = (v: number) => `${(Math.max(0, v) / max) * 100}%`;

  return (
    <figure className="tarjeta flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{titulo}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-suave" aria-hidden="true">
            {series.map((s) => (
              <span key={s.nombre} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: `var(--color-serie-${s.color})` }} />
                {s.nombre}
              </span>
            ))}
          </span>
        )}
      </figcaption>

      {sinDatos ? (
        <p className="py-8 text-center text-sm text-apagado">Todavía no hay datos para graficar.</p>
      ) : (
        <div className="flex gap-2 pt-3" aria-hidden="true">
          {/* Eje: solo unas pocas marcas, tenues. */}
          <div className="relative w-20 shrink-0 text-right text-[11px] text-apagado" style={{ height: alto }}>
            {marcas.map((x) => (
              <span key={x.valor} className="num absolute right-0 -translate-y-1/2" style={{ bottom: pct(x.valor) }}>
                {x.texto}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: alto }} onMouseLeave={() => setActivo(null)}>
              {marcas.map((x) => (
                <div key={x.valor} className={`absolute inset-x-0 border-t ${x.valor === 0 ? "border-borde" : "border-dashed border-linea"}`} style={{ bottom: pct(x.valor) }} />
              ))}
              <div className="absolute inset-0 flex">
                {etiquetas.map((e, i) => {
                  const atenuado = resaltar != null && resaltar !== i && activo !== i;
                  return (
                    <div
                      key={e + i}
                      className={`relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-t px-[3px] ${activo === i ? "bg-fondo" : ""}`}
                      onMouseEnter={() => setActivo(i)}
                      onClick={() => setActivo(activo === i ? null : i)}
                    >
                      {series.map((s) => (
                        <div
                          key={s.nombre}
                          className="w-full max-w-5 rounded-t-[4px] transition-opacity"
                          style={{ height: s.valores[i] > 0 ? `max(2px, ${pct(s.valores[i])})` : 0, background: `var(--color-serie-${s.color})`, opacity: atenuado ? 0.3 : 1 }}
                        />
                      ))}
                      {activo === i && (
                        <div
                          className={`pointer-events-none absolute top-0 z-20 w-max min-w-44 whitespace-nowrap rounded-lg border border-borde bg-superficie p-2.5 text-xs shadow-lg ${i > etiquetas.length / 2 ? "right-full mr-1" : "left-full ml-1"}`}
                        >
                          <b className="block pb-1 text-[13px]">{largas[i]}</b>
                          {series.map((s) => (
                            <span key={s.nombre} className="flex items-center justify-between gap-3 py-0.5">
                              <span className="inline-flex items-center gap-1.5 text-suave">
                                <span className="size-2 rounded-sm" style={{ background: `var(--color-serie-${s.color})` }} />
                                {s.nombre}
                              </span>
                              <span className="num font-semibold text-tinta">{s.textos[i]}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1 flex text-[11px] text-apagado">
              {etiquetas.map((e, i) => (
                <span key={e + i} className={`flex-1 truncate text-center ${resaltar === i ? "font-bold text-tinta" : ""}`}>
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lo mismo en tabla, para lectores de pantalla. */}
      <table className="sr-only">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th>Período</th>
            {series.map((s) => (
              <th key={s.nombre}>{s.nombre}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {etiquetas.map((e, i) => (
            <tr key={e + i}>
              <td>{largas[i]}</td>
              {series.map((s) => (
                <td key={s.nombre}>{s.textos[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
