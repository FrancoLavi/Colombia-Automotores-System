import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { agenda } from "@/server/contactos";
import { fecha, hoyIso } from "@/lib/formato";
import { ETIQUETA_ACTIVIDAD } from "@/domain/contactos";
import { Telefono } from "../chips";
import { FormCompletar } from "../formularios";

export const metadata = { title: "Agenda · Colombia Automotores" };

type Item = {
  clave: string;
  dia: string;
  hora: string | null;
  contacto: { id: number; nombre: string; apellido: string | null; telefono: string | null };
  detalle: string;
  actividadId: number | null;
};

export default async function AgendaPage() {
  await requerirUsuario();
  const hoy = hoyIso();
  const manana = hoyIso(new Date(Date.now() + 86_400_000));
  const { actividades, proximos } = await agenda(manana);

  const items: Item[] = [
    ...actividades.map(({ a, contacto }) => ({
      clave: `a${a.id}`,
      dia: hoyIso(a.fechaProgramada),
      hora: a.fechaProgramada.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      contacto,
      detalle: `${ETIQUETA_ACTIVIDAD[a.tipo]}${a.nota ? ` · ${a.nota}` : ""}`,
      actividadId: a.id,
    })),
    ...proximos.map((c) => ({
      clave: `c${c.id}`,
      dia: c.proximoContacto!,
      hora: null,
      contacto: c,
      detalle: `Volver a contactar${c.productoInteres ? ` · busca ${c.productoInteres}` : ""}`,
      actividadId: null,
    })),
  ].sort((x, y) => (x.dia + (x.hora ?? "99")).localeCompare(y.dia + (y.hora ?? "99")));

  const grupos = [
    { titulo: "Atrasados", items: items.filter((i) => i.dia < hoy), clase: "text-aviso-texto" },
    { titulo: `Hoy · ${fecha(hoy)}`, items: items.filter((i) => i.dia === hoy), clase: "" },
    { titulo: `Mañana · ${fecha(manana)}`, items: items.filter((i) => i.dia === manana), clase: "" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contactos" className="text-sm font-semibold">
        ← Volver a contactos
      </Link>
      <h1 className="text-3xl font-bold">Agenda</h1>
      {items.length === 0 && <p className="tarjeta text-suave">No hay nada agendado para hoy ni mañana.</p>}
      {grupos
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.titulo} className="flex flex-col gap-2.5">
            <h2 className={`text-lg font-semibold ${g.clase}`}>
              {g.titulo} · {g.items.length}
            </h2>
            {g.items.map((i) => (
              <article key={i.clave} className="tarjeta flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  {i.hora && <span className="num text-apagado">{i.hora}</span>}
                  {g.titulo === "Atrasados" && <span className="num text-aviso-texto">{fecha(i.dia)}</span>}
                  <Link href={`/contactos/${i.contacto.id}`} className="font-semibold text-tinta">
                    {i.contacto.nombre} {i.contacto.apellido}
                  </Link>
                  <Telefono telefono={i.contacto.telefono} />
                  <span className="text-sm text-suave">{i.detalle}</span>
                </div>
                <FormCompletar actividadId={i.actividadId} contactoId={i.contacto.id} />
              </article>
            ))}
          </section>
        ))}
    </div>
  );
}
