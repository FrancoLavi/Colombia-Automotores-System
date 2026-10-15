import { requerirUsuario } from "@/lib/auth";
import { salir } from "../login/actions";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requerirUsuario();
  return (
    <div className="min-h-screen md:flex">
      <Nav nombre={u.nombre} salir={salir} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
