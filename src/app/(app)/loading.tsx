/** Mientras carga una pantalla: barra arriba y un esqueleto, para que se note que el clic hizo algo. */
export default function Cargando() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5">
      <span className="sr-only">Cargando…</span>
      <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-info-fondo">
        <div className="h-full w-1/3 animate-[cargando_1.1s_ease-in-out_infinite] bg-acento" />
      </div>
      <div className="h-9 w-56 animate-pulse rounded-lg bg-linea" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="tarjeta flex flex-col gap-3">
            <div className="h-3 w-24 animate-pulse rounded bg-linea" />
            <div className="h-7 w-40 animate-pulse rounded bg-linea" />
          </div>
        ))}
      </div>
      <div className="tarjeta flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-linea" style={{ width: `${90 - i * 9}%` }} />
        ))}
      </div>
    </div>
  );
}
