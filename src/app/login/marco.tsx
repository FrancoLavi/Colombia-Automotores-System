import { IlustracionAuto } from "@/components/ilustraciones";

/** Marco común de las pantallas sin sesión: ingresar, recuperar y restablecer la contraseña. */
export function MarcoAcceso({ titulo, bajada, children }: { titulo: string; bajada: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fondo p-4">
      <div className="grid w-full max-w-3xl overflow-hidden rounded-2xl border border-borde bg-superficie md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-between gap-6 bg-panel p-8">
          <div>
            <p className="font-display text-xl font-bold">
              Colombia <span className="text-acento">· gestión</span>
            </p>
            <p className="mt-2 text-sm text-suave">Stock, ventas, caja y patrimonio del salón en un solo lugar.</p>
          </div>
          <IlustracionAuto className="w-full max-w-xs self-center" />
        </div>
        <div className="p-8">
          <h1 className="text-2xl font-bold">{titulo}</h1>
          <p className="mb-6 mt-1 text-sm text-suave">{bajada}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
