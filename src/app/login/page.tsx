import { FormLogin } from "./form";
import { MarcoAcceso } from "./marco";

export const metadata = { title: "Ingresar · Colombia Automotores" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ volver?: string; motivo?: string }> }) {
  const { volver, motivo } = await searchParams;
  return (
    <MarcoAcceso titulo="Ingresar" bajada="Con tu mail y contraseña.">
      {motivo === "vencida" && (
        <p role="status" className="mb-4 rounded-lg bg-info-fondo px-3 py-2 text-sm text-info-texto">
          Tu sesión se cerró por seguridad (8 horas sin uso o una semana desde que ingresaste). Volvé a ingresar y seguís donde estabas.
        </p>
      )}
      <FormLogin volver={volver ?? ""} />
    </MarcoAcceso>
  );
}
