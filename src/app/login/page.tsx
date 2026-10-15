import { FormLogin } from "./form";

export const metadata = { title: "Ingresar · Colombia Automotores" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fondo p-4">
      <div className="tarjeta w-full max-w-sm">
        <h1 className="text-2xl font-bold">Colombia Automotores</h1>
        <p className="mb-6 mt-1 text-sm text-suave">Ingresá con tu mail y contraseña.</p>
        <FormLogin />
      </div>
    </main>
  );
}
